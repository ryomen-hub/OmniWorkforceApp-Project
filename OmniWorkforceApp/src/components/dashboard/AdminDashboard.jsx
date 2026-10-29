import { useMemo, useState } from "react";
import { adminApiRequest, useAdminRows } from "../../hooks/useAdminRows";
import StatusPill from "../shared/StatusPill";
import "../admin/AdminPortal.css";

export default function AdminDashboard({ authHeader, showToast }) {
  const applicants = useAdminRows("/applicants", authHeader);
  const payroll = useAdminRows("/payroll", authHeader);
  const postings = useAdminRows("/job-postings", authHeader);
  const [postingFormOpen, setPostingFormOpen] = useState(false);
  const [postingTitle, setPostingTitle] = useState("");
  const [postingDepartment, setPostingDepartment] = useState("");
  const [postingDescription, setPostingDescription] = useState("");
  const [savingPosting, setSavingPosting] = useState(false);
  const [postingError, setPostingError] = useState("");
  const [updatingPosting, setUpdatingPosting] = useState("");

  const activePostings = useMemo(
    () => postings.rows.filter((posting) => posting.status === "Active"),
    [postings.rows]
  );
  const syncedCount = payroll.rows.filter((record) => /auto.?synced/i.test(record.status || "")).length;
  const syncAccuracy = payroll.rows.length ? `${Math.round((syncedCount / payroll.rows.length) * 100)}%` : "—";
  const loading = applicants.loading || payroll.loading || postings.loading;

  const createPosting = async (event) => {
    event.preventDefault();
    setSavingPosting(true);
    setPostingError("");
    try {
      await adminApiRequest("/job-postings", authHeader, {
        method: "POST",
        body: JSON.stringify({
          title: postingTitle.trim(),
          department: postingDepartment.trim(),
          description: postingDescription.trim(),
        }),
      });
      setPostingTitle("");
      setPostingDepartment("");
      setPostingDescription("");
      setPostingFormOpen(false);
      showToast("Job posting created.");
      await postings.reload();
    } catch (error) {
      setPostingError(error.message || "Could not create job posting.");
    } finally {
      setSavingPosting(false);
    }
  };

  const updatePostingStatus = async (posting, status) => {
    setUpdatingPosting(String(posting.id));
    setPostingError("");
    try {
      await adminApiRequest(`/job-postings/${posting.id}`, authHeader, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await postings.reload();
      showToast(`Posting marked ${status.toLowerCase()}.`);
    } catch (error) {
      setPostingError(error.message || "Could not update job posting.");
    } finally {
      setUpdatingPosting("");
    }
  };

  const error = applicants.error || payroll.error || postings.error;

  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <div>
          <h1>Recruitment Dashboard &amp; ATS Pipeline</h1>
          <p>Track active job postings, applicant activity, and payroll sync status.</p>
        </div>
      </div>
      <div className="metrics-grid admin-dashboard-metrics">
        <div className="metric-card"><div className="metric-header">Active Job Postings</div><div className="metric-value admin-metric-blue">{loading ? "—" : activePostings.length}</div></div>
        <div className="metric-card"><div className="metric-header">Candidates in Pipeline</div><div className="metric-value">{applicants.loading ? "—" : applicants.rows.length}</div></div>
        <div className="metric-card"><div className="metric-header">Auto-Synced Payroll Records</div><div className="metric-value admin-metric-purple">{payroll.loading ? "—" : syncAccuracy}</div></div>
      </div>
      {error && <div className="admin-notice admin-notice-error" role="alert">{error}</div>}
      {postingError && <div className="admin-notice admin-notice-error" role="alert">{postingError}</div>}

      <section className="dash-card admin-dashboard-card">
        <div className="admin-section-heading">
          <h2>📌 Active Job Postings</h2>
          <button className="btn-primary btn-small admin-heading-action" onClick={() => setPostingFormOpen((open) => !open)}>
            {postingFormOpen ? "Cancel" : "+ Create Posting"}
          </button>
        </div>
        <p>Applicants are counted when they are linked to a posting in the HR pipeline.</p>
        {postingFormOpen && (
          <form className="admin-posting-form" onSubmit={createPosting}>
            <label>Job title<input required value={postingTitle} onChange={(event) => setPostingTitle(event.target.value)} /></label>
            <label>Department<input required value={postingDepartment} onChange={(event) => setPostingDepartment(event.target.value)} /></label>
            <label>Description<textarea value={postingDescription} onChange={(event) => setPostingDescription(event.target.value)} rows="2" /></label>
            <button className="btn-primary btn-small" type="submit" disabled={savingPosting}>{savingPosting ? "Saving…" : "Save Posting"}</button>
          </form>
        )}
        {postings.loading ? <div className="admin-notice">Loading postings…</div> : postings.error ? null : activePostings.length === 0 ? <div className="admin-notice">No active job postings. Create a posting to start tracking applications.</div> : (
          <div className="table-responsive"><table>
            <thead><tr><th>Job Title</th><th>Department</th><th>Applicants</th><th>Status</th></tr></thead>
            <tbody>{activePostings.map((posting) => (
              <tr key={posting.id}>
                <td><strong>{posting.title}</strong></td>
                <td>{posting.department}</td>
                <td><strong className="admin-count-link">{posting.applicant_count} candidates</strong></td>
                <td>
                  <select
                    aria-label={`Change status for ${posting.title}`}
                    className="admin-stage-select"
                    disabled={updatingPosting === String(posting.id)}
                    value={posting.status}
                    onChange={(event) => updatePostingStatus(posting, event.target.value)}
                  >
                    <option>Active</option><option>Paused</option><option>Closed</option>
                  </select>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {postings.rows.some((posting) => posting.status !== "Active") && (
          <details className="admin-inactive-postings">
            <summary>Paused or closed postings</summary>
            <div className="table-responsive"><table>
              <thead><tr><th>Job Title</th><th>Department</th><th>Applicants</th><th>Status</th></tr></thead>
              <tbody>{postings.rows.filter((posting) => posting.status !== "Active").map((posting) => (
                <tr key={posting.id}>
                  <td><strong>{posting.title}</strong></td>
                  <td>{posting.department}</td>
                  <td>{posting.applicant_count} candidates</td>
                  <td>
                    <select
                      aria-label={`Change status for ${posting.title}`}
                      className="admin-stage-select"
                      disabled={updatingPosting === String(posting.id)}
                      value={posting.status}
                      onChange={(event) => updatePostingStatus(posting, event.target.value)}
                    >
                      <option>Active</option><option>Paused</option><option>Closed</option>
                    </select>
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          </details>
        )}
      </section>

      <section className="dash-card admin-dashboard-card">
        <h2>👥 Candidate Pipeline Overview</h2>
        {applicants.loading ? <div className="admin-notice">Loading applicant data…</div> : applicants.error ? null : applicants.rows.length === 0 ? <div className="admin-notice">No candidates are in the pipeline.</div> : (
          <div className="table-responsive"><table>
            <thead><tr><th>Candidate ID</th><th>Name</th><th>Position</th><th>Current Stage</th></tr></thead>
            <tbody>{applicants.rows.map((applicant) => (
              <tr key={applicant.id}><td><strong className="admin-count-link">{applicant.id}</strong></td><td><strong>{applicant.name}</strong></td><td>{applicant.posting_title || applicant.job_offer || "—"}</td><td><StatusPill type={/interview/i.test(applicant.bpo_status || "") ? "interview" : /hired|onboard/i.test(applicant.bpo_status || "") ? "verified" : "pending"}>{applicant.bpo_status || "Pending Application"}</StatusPill></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </section>
  );
}
