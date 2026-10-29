import { useEffect, useMemo, useRef, useState } from "react";
import { ALL_ROLES } from "../../constants/roles";
import { adminApiRequest, useAdminRows } from "../../hooks/useAdminRows";
import StatusPill from "../shared/StatusPill";
import "./AdminPortal.css";
import PayrollWorkspace from "../payroll/PayrollWorkspace";

const CANDIDATE_STAGES = [
  "Pending Application",
  "Initial Screening",
  "Operations Interview",
  "Client Interview",
  "Offer Extended",
  "Hired & Onboarded",
  "Rejected",
];

function PageHeading({ title, description, action }) {
  return (
    <div className="admin-page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

function RequestState({ loading, error, empty, children }) {
  if (loading) return <div className="admin-notice">Loading data…</div>;
  if (error) return <div className="admin-notice admin-notice-error" role="alert">{error}</div>;
  if (empty) return <div className="admin-notice">{empty}</div>;
  return children;
}

function StagePill({ stage }) {
  const type = /hired|onboard/i.test(stage)
    ? "verified"
    : /interview/i.test(stage)
      ? "interview"
      : /reject/i.test(stage)
        ? "rejected"
        : "pending";
  return <StatusPill type={type}>{stage}</StatusPill>;
}

function getInitials(email = "") {
  const localPart = email.split("@")[0] || "?";
  return localPart.split(/[._-]/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
}

function getDisplayName(email = "") {
  const localPart = email.split("@")[0] || email;
  return localPart.split(/[._-]/).filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

export function AdminUsersPage({
  authHeader,
  showToast,
  heading = "System Users & Staff Directory",
  description = "Admin view: accounts across every department.",
}) {
  const { rows: users, loading, error, reload } = useAdminRows("/users", authHeader);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(ALL_ROLES[0]);
  const [password, setPassword] = useState("");

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => !query || `${user.email} ${user.role}`.toLowerCase().includes(query));
  }, [users, search]);

  const createAccount = async (event) => {
    event.preventDefault();
    setSaving(true);
    setCreateError("");
    try {
      await adminApiRequest("/users", authHeader, {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), role, password }),
      });
      setEmail("");
      setPassword("");
      setCreateOpen(false);
      showToast("Account created.");
      await reload();
    } catch (requestError) {
      setCreateError(requestError.message || "Could not create account.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-page">
      <PageHeading
        title={heading}
        description={description}
        action={<button className="btn-primary btn-small admin-heading-action" onClick={() => setCreateOpen((open) => !open)}>+ Create Account</button>}
      />
      {createOpen && (
        <form className="dash-card admin-create-form" onSubmit={createAccount}>
          <h2>Create account</h2>
          <div className="admin-form-grid">
            <label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Role<select value={role} onChange={(event) => setRole(event.target.value)}>{ALL_ROLES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Temporary password<input required minLength="4" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          </div>
          {createError && <div className="admin-inline-error" role="alert">{createError}</div>}
          <div className="admin-form-actions">
            <button className="btn-primary btn-small" disabled={saving} type="submit">{saving ? "Creating…" : "Create Account"}</button>
            <button className="admin-secondary-btn" type="button" onClick={() => { setCreateOpen(false); setCreateError(""); }}>Cancel</button>
          </div>
        </form>
      )}
      {selectedUser && (
        <section className="dash-card admin-profile-card">
          <button className="admin-close-btn" aria-label="Close profile" onClick={() => setSelectedUser(null)}>×</button>
          <div className="admin-avatar">{getInitials(selectedUser.email)}</div>
          <h2>{getDisplayName(selectedUser.email)}</h2>
          <p>{selectedUser.email}</p>
          <StatusPill type="interview">{selectedUser.role}</StatusPill>
          <small>Account created {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : "date unavailable"}</small>
        </section>
      )}
      <div className="admin-search-wrap">
        <input className="admin-search" type="search" placeholder="Search name, email, or department…" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <RequestState loading={loading} error={error} empty={visibleUsers.length ? "" : "No user accounts match this search."}>
        <div className="admin-user-grid">
          {visibleUsers.map((user) => (
            <article className="dash-card admin-user-card" key={user.id}>
              <div className="admin-avatar">{getInitials(user.email)}</div>
              <h2>{getDisplayName(user.email)}</h2>
              <p>{user.role}</p>
              <div className="admin-user-email">{user.email}</div>
              <button className="admin-secondary-btn admin-profile-button" onClick={() => setSelectedUser(user)}>Inspect Profile</button>
            </article>
          ))}
        </div>
      </RequestState>
    </section>
  );
}

export function AdminPayrollDashboard({ authHeader }) {
  const { rows: payroll, loading, error } = useAdminRows("/payroll", authHeader);
  const autoSynced = payroll.filter((record) => /auto.?synced/i.test(record.status || "")).length;
  const requiresReview = payroll.length - autoSynced;

  return (
    <section className="admin-page">
      <PageHeading title="Payroll Staff Portal & Overview" description="View current payroll records and sync status." />
      <div className="metrics-grid admin-metrics-grid">
        <div className="metric-card"><div className="metric-header">Auto-Synced Records</div><div className="metric-value admin-metric-blue">{loading ? "—" : autoSynced}</div><div className="metric-footer">Based on connected payroll records</div></div>
        <div className="metric-card"><div className="metric-header">Manual Review Required</div><div className="metric-value">{loading ? "—" : requiresReview}</div><div className="metric-footer">Records not marked auto-synced</div></div>
      </div>
      <div className="dash-card admin-table-card">
        <RequestState loading={loading} error={error} empty={payroll.length ? "" : "No payroll records are available."}>
          <div className="table-responsive"><table>
            <thead><tr><th>Employee ID</th><th>Full Name</th><th>Position</th><th>Cutoff Status</th></tr></thead>
            <tbody>{payroll.map((record) => (
              <tr key={record.id}>
                <td><strong>{record.employee_code || "—"}</strong></td>
                <td>{record.applicant_name || "Name unavailable"}</td>
                <td>{record.position || "—"}</td>
                <td><StatusPill type={/auto.?synced/i.test(record.status || "") ? "verified" : "pending"}>{record.status || "Needs review"}</StatusPill></td>
              </tr>
            ))}</tbody>
          </table></div>
        </RequestState>
      </div>
    </section>
  );
}

export function AdminHrDashboard({ authHeader, showToast }) {
  const { rows: applicants, loading, error, reload } = useAdminRows("/applicants", authHeader);
  const [updating, setUpdating] = useState("");
  const [actionError, setActionError] = useState("");

  const updateStage = async (applicant, bpo_status) => {
    setUpdating(String(applicant.id));
    setActionError("");
    try {
      await adminApiRequest(`/applicants/${applicant.id}`, authHeader, {
        method: "PATCH",
        body: JSON.stringify({ bpo_status }),
      });
      showToast(`Updated ${applicant.name}'s recruitment stage.`);
      await reload();
    } catch (requestError) {
      setActionError(requestError.message || "Could not update candidate stage.");
    } finally {
      setUpdating("");
    }
  };

  return (
    <section className="admin-page">
      <PageHeading title="HR & Recruitment Candidate Database" description="Review applicant stages and update the hiring pipeline." />
      {actionError && <div className="admin-notice admin-notice-error" role="alert">{actionError}</div>}
      <div className="dash-card admin-table-card">
        <RequestState loading={loading} error={error} empty={applicants.length ? "" : "No applicants are available."}>
          <div className="table-responsive"><table>
            <thead><tr><th>Candidate ID</th><th>Name</th><th>Position</th><th>Current Stage</th><th>Automated Update</th><th>Update Stage</th></tr></thead>
            <tbody>{applicants.map((applicant) => (
              <tr key={applicant.id}>
                <td><strong>{applicant.id}</strong></td>
                <td>{applicant.name}</td>
                <td>{applicant.job_offer || "—"}</td>
                <td><StagePill stage={applicant.bpo_status || "Pending Application"} /></td>
                <td className="admin-sync-note">Synced from applicant record</td>
                <td><select className="admin-stage-select" aria-label={`Update stage for ${applicant.name}`} disabled={updating === String(applicant.id)} value={CANDIDATE_STAGES.includes(applicant.bpo_status) ? applicant.bpo_status : "Pending Application"} onChange={(event) => updateStage(applicant, event.target.value)}>{CANDIDATE_STAGES.map((stage) => <option key={stage}>{stage}</option>)}</select></td>
              </tr>
            ))}</tbody>
          </table></div>
        </RequestState>
      </div>
    </section>
  );
}

export function AdminAtsSync({ authHeader, showToast }) {
  const { rows: payroll, loading: payrollLoading, error: payrollError } = useAdminRows("/payroll", authHeader);
  const { rows: applicants, loading: applicantsLoading, error: applicantsError } = useAdminRows("/applicants", authHeader);
  const [activeTab, setActiveTab] = useState("payslips");
  const [search, setSearch] = useState("");
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const applicantById = useMemo(() => new Map(applicants.map((applicant) => [String(applicant.id), applicant])), [applicants]);
  const isLoading = payrollLoading || (activeTab !== "payslips" && applicantsLoading);
  const error = payrollError || (activeTab === "recruitment" ? applicantsError : "");
  const visiblePayroll = payroll.filter((record) => {
    const applicant = applicantById.get(String(record.applicant_id));
    const query = search.trim().toLowerCase();
    return !query || `${record.employee_code} ${record.applicant_name} ${record.position} ${applicant?.email || ""}`.toLowerCase().includes(query);
  });
  const visibleApplicants = applicants.filter((applicant) =>
    !search.trim() || `${applicant.id} ${applicant.name} ${applicant.job_offer} ${applicant.bpo_status}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <section className="admin-page">
      <PageHeading title="ATS & Payroll Sync Data" description="Review connected payroll records and recruitment stages." />
      <div className="admin-tabs" role="tablist" aria-label="ATS and payroll views">
        {[["payslips", "Payslips"], ["monitoring", "Monitoring Table"], ["recruitment", "Recruitment Process"]].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={activeTab === id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </div>
      <div className="admin-search-wrap"><input className="admin-search" type="search" placeholder="Search employee, ID, or position…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      {activeTab === "payslips" ? <PayrollWorkspace authHeader={authHeader} showToast={showToast} /> : <div className="dash-card admin-table-card">
        <RequestState loading={isLoading} error={error} empty={activeTab === "recruitment" ? (visibleApplicants.length ? "" : "No applicants are available.") : (visiblePayroll.length ? "" : "No payroll records are available.")}>
          {activeTab === "monitoring" && <div className="table-responsive"><table><thead><tr><th>Employee ID</th><th>Full Name</th><th>Contact</th><th>Last Synced</th><th>Sync Status</th></tr></thead><tbody>
            {visiblePayroll.map((record) => { const applicant = applicantById.get(String(record.applicant_id)); return <tr key={record.id}><td><strong>{record.employee_code || "—"}</strong></td><td>{record.applicant_name || "Name unavailable"}</td><td>{applicant?.email || "—"}</td><td>{record.created_at ? new Date(record.created_at).toLocaleString() : "—"}</td><td><StatusPill type={/auto.?synced/i.test(record.status || "") ? "verified" : "pending"}>{record.status || "Needs review"}</StatusPill></td></tr>; })}
          </tbody></table></div>}
          {activeTab === "recruitment" && <div className="table-responsive"><table><thead><tr><th>Candidate ID</th><th>Full Name</th><th>Position</th><th>Recruitment Stage</th><th>Action</th></tr></thead><tbody>
            {visibleApplicants.map((applicant) => <tr key={applicant.id}><td><strong>{applicant.id}</strong></td><td>{applicant.name}</td><td>{applicant.posting_title || applicant.job_offer || "—"}</td><td><StagePill stage={applicant.bpo_status || "Pending Application"} /></td><td><button className="admin-secondary-btn" onClick={() => setSelectedApplicant(applicant)}>View ATS Profile</button></td></tr>)}
          </tbody></table></div>}
        </RequestState>
        {activeTab === "recruitment" && selectedApplicant && (
          <section className="admin-ats-profile">
            <button className="admin-close-btn" aria-label="Close ATS profile" onClick={() => setSelectedApplicant(null)}>×</button>
            <h2>{selectedApplicant.name}</h2>
            <dl>
              <div><dt>Candidate ID</dt><dd>{selectedApplicant.id}</dd></div>
              <div><dt>Email</dt><dd>{selectedApplicant.email || "Not provided"}</dd></div>
              <div><dt>Position</dt><dd>{selectedApplicant.posting_title || selectedApplicant.job_offer || "Not specified"}</dd></div>
              <div><dt>Recruitment stage</dt><dd>{selectedApplicant.bpo_status || "Pending Application"}</dd></div>
            </dl>
          </section>
        )}
      </div>}
    </section>
  );
}

function conversationTitle(conversation, currentUserEmail) {
  if (conversation.is_group) return conversation.name;
  const other = conversation.members?.find((member) => member.email.toLowerCase() !== currentUserEmail.toLowerCase());
  return other ? getDisplayName(other.email) : "Direct message";
}

export function AdminTeamMessenger({ authHeader, loggedInEmail, socket, colleaguesPath = "/users" }) {
  const { rows: colleagues, loading, error } = useAdminRows(colleaguesPath, authHeader);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [conversationLoading, setConversationLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [sending, setSending] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const messagesEndRef = useRef(null);
  const selectedConversation = conversations.find((item) => String(item.id) === String(selectedConversationId));

  const loadConversations = async () => {
    try {
      const rows = await adminApiRequest("/conversations", authHeader);
      setConversations(rows);
      setChatError("");
      return rows;
    } catch (requestError) {
      setChatError(requestError.message || "Could not load conversations.");
      return [];
    } finally {
      setConversationLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    setMessagesLoading(true);
    setChatError("");
    try {
      const rows = await adminApiRequest(`/conversations/${conversationId}/messages`, authHeader);
      setMessages(rows);
      await adminApiRequest(`/conversations/${conversationId}/read`, authHeader, { method: "PATCH" });
      await loadConversations();
    } catch (requestError) {
      setChatError(requestError.message || "Could not load conversation messages.");
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [authHeader]);

  useEffect(() => {
    if (selectedConversationId) loadMessages(selectedConversationId);
    else setMessages([]);
  }, [selectedConversationId, authHeader]);

  useEffect(() => {
    if (!socket) return undefined;
    const onNewMessage = (message) => {
      if (String(message.conversation_id) === String(selectedConversationId)) {
        setMessages((items) => items.some((item) => String(item.id) === String(message.id)) ? items : [...items, message]);
        adminApiRequest(`/conversations/${message.conversation_id}/read`, authHeader, { method: "PATCH" })
          .then(() => loadConversations())
          .catch((requestError) => setChatError(requestError.message || "Could not update message status."));
      } else {
        loadConversations();
      }
    };
    const onNewConversation = () => loadConversations();
    socket.on("message:new", onNewMessage);
    socket.on("conversation:new", onNewConversation);
    return () => {
      socket.off("message:new", onNewMessage);
      socket.off("conversation:new", onNewConversation);
    };
  }, [socket, selectedConversationId, authHeader]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectConversation = (conversation) => setSelectedConversationId(String(conversation.id));

  const startDirectMessage = async (user) => {
    setChatError("");
    try {
      const conversation = await adminApiRequest("/conversations", authHeader, {
        method: "POST",
        body: JSON.stringify({ member_ids: [user.id] }),
      });
      await loadConversations();
      selectConversation(conversation);
    } catch (requestError) {
      setChatError(requestError.message || "Could not start conversation.");
    }
  };

  const createGroup = async (event) => {
    event.preventDefault();
    if (groupMembers.length < 2) {
      setChatError("Choose at least two colleagues for a group conversation.");
      return;
    }
    setCreatingGroup(true);
    setChatError("");
    try {
      const conversation = await adminApiRequest("/conversations", authHeader, {
        method: "POST",
        body: JSON.stringify({ name: groupName.trim(), member_ids: groupMembers }),
      });
      setGroupOpen(false);
      setGroupName("");
      setGroupMembers([]);
      await loadConversations();
      selectConversation(conversation);
    } catch (requestError) {
      setChatError(requestError.message || "Could not create group conversation.");
    } finally {
      setCreatingGroup(false);
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!selectedConversationId || !messageBody.trim()) return;
    setSending(true);
    setChatError("");
    try {
      const message = await adminApiRequest(`/conversations/${selectedConversationId}/messages`, authHeader, {
        method: "POST",
        body: JSON.stringify({ body: messageBody.trim() }),
      });
      setMessages((items) => items.some((item) => String(item.id) === String(message.id)) ? items : [...items, message]);
      setMessageBody("");
      await loadConversations();
    } catch (requestError) {
      setChatError(requestError.message || "Could not send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="admin-page">
      <PageHeading title="Internal Team Messenger" description="Real-time direct and group messaging across the organization." />
      {chatError && <div className="admin-notice admin-notice-error" role="alert">{chatError}</div>}
      <div className="admin-messenger">
        <aside className="admin-messenger-list">
          <div className="admin-messenger-list-heading">
            <strong>Messages</strong>
            <button className="admin-new-group-btn" onClick={() => setGroupOpen((open) => !open)}>+ New Group</button>
          </div>
          <div className="admin-contact-section">
            <span className="admin-muted-label">Active chats</span>
            {conversationLoading ? <div className="admin-notice">Loading conversations…</div> : conversations.length === 0 ? <div className="admin-contact-empty">No active conversations yet.</div> : conversations.map((conversation) => (
              <button
                className={`admin-contact ${String(conversation.id) === String(selectedConversationId) ? "active" : ""}`}
                key={conversation.id}
                onClick={() => selectConversation(conversation)}
              >
                <span className="admin-contact-avatar">{conversation.is_group ? "GR" : getInitials(conversationTitle(conversation, loggedInEmail))}</span>
                <span className="admin-contact-text">
                  <strong>{conversationTitle(conversation, loggedInEmail)}</strong>
                  <small>{conversation.last_message?.body || (conversation.is_group ? "Group conversation" : "No messages yet")}</small>
                </span>
                {conversation.unread_count > 0 && <span className="admin-unread-badge">{conversation.unread_count}</span>}
              </button>
            ))}
          </div>
          <div className="admin-contact-section">
            <span className="admin-muted-label">Direct message a team member</span>
            <RequestState loading={loading} error={error} empty={colleagues.length ? "" : "No colleagues found."}>
            {colleagues.map((user) => (
              <button className="admin-contact" key={user.id} onClick={() => startDirectMessage(user)}>
                <span className="admin-contact-avatar">{getInitials(user.email)}</span>
                <span><strong>{getDisplayName(user.email)}</strong><small>{user.role}</small></span>
              </button>
            ))}
            </RequestState>
          </div>
        </aside>
        <div className="admin-messenger-conversation">
          {selectedConversation ? (
            <>
              <div className="admin-conversation-header">
                <div className="admin-contact-avatar">{selectedConversation.is_group ? "GR" : getInitials(conversationTitle(selectedConversation, loggedInEmail))}</div>
                <div><strong>{conversationTitle(selectedConversation, loggedInEmail)}</strong><small>{selectedConversation.is_group ? `${selectedConversation.members.length} members` : "Direct message"}</small></div>
              </div>
              <div className="admin-message-list" aria-live="polite">
                {messagesLoading ? <div className="admin-notice">Loading messages…</div> : messages.length === 0 ? <div className="admin-message-placeholder"><div className="admin-message-icon">☁</div><h2>No messages yet</h2><p>Send the first message to start the conversation.</p></div> : messages.map((message) => {
                  const isMine = message.sender_email?.toLowerCase() === loggedInEmail.toLowerCase();
                  return (
                    <div className={`admin-message-row ${isMine ? "mine" : ""}`} key={message.id}>
                      <div className="admin-message-bubble">
                        {!isMine && <strong>{getDisplayName(message.sender_email)}</strong>}
                        <p>{message.body}</p>
                        <time>{new Date(message.created_at).toLocaleString()}</time>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <form className="admin-message-compose" onSubmit={sendMessage}>
                <textarea aria-label="Message" maxLength="5000" placeholder="Write a message…" value={messageBody} onChange={(event) => setMessageBody(event.target.value)} />
                <button className="btn-primary btn-small" disabled={sending || !messageBody.trim()} type="submit">{sending ? "Sending…" : "Send"}</button>
              </form>
            </>
          ) : (
            <div className="admin-message-placeholder">
              <div className="admin-message-icon">☁</div>
              <h2>Your Messages</h2>
              <p>Select an active conversation or a colleague to begin communicating.</p>
            </div>
          )}
        </div>
      </div>
      {groupOpen && (
        <div className="admin-group-modal-backdrop" role="presentation" onClick={() => setGroupOpen(false)}>
          <form className="dash-card admin-group-modal" onSubmit={createGroup} onClick={(event) => event.stopPropagation()}>
            <h2>New group conversation</h2>
            <label>Group name<input required value={groupName} onChange={(event) => setGroupName(event.target.value)} /></label>
            <fieldset>
              <legend>Choose at least two colleagues</legend>
              {colleagues.map((user) => (
                <label className="admin-group-option" key={user.id}>
                  <input
                    type="checkbox"
                    checked={groupMembers.includes(String(user.id))}
                    onChange={(event) => setGroupMembers((members) => event.target.checked
                      ? [...members, String(user.id)]
                      : members.filter((id) => id !== String(user.id)))}
                  />
                  {getDisplayName(user.email)} <small>{user.role}</small>
                </label>
              ))}
            </fieldset>
            <div className="admin-form-actions">
              <button className="btn-primary btn-small" type="submit" disabled={creatingGroup}>{creatingGroup ? "Creating…" : "Create Group"}</button>
              <button className="admin-secondary-btn" type="button" onClick={() => setGroupOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
