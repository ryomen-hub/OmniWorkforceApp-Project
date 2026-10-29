// The backend routes mail by DEPARTMENT (recipient_role), not by a typed
// address — so "To" is a dropdown of departments. A free-text address
// couldn't be matched reliably to an inbox.
export default function ComposeModal({ open, roles, recipientRole, setRecipientRole, subject, setSubject, body, setBody, onClose, onSend }) {
  return (
    <div className={`compose-modal ${open ? "active" : ""}`}>
      <div className="compose-header">
        <span>New Department Message (Gmail Workspace)</span>
        <button style={{ cursor: "pointer", fontSize: "1.1rem" }} onClick={onClose}>×</button>
      </div>
      <div className="compose-body">
        <select className="text-input" value={recipientRole} onChange={(event) => setRecipientRole(event.target.value)}>
          <option value="">To: choose a department…</option>
          {roles.map((role) => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
        <input type="text" className="text-input" placeholder="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
        <textarea className="textarea-input" style={{ minHeight: 120 }} placeholder="Compose your email message..." value={body} onChange={(event) => setBody(event.target.value)} />
        <button type="button" className="btn-primary" onClick={onSend}>Send Message</button>
      </div>
    </div>
  );
}
