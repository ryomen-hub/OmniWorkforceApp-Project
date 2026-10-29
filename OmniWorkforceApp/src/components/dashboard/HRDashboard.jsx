import StatusPill from "../shared/StatusPill";
import { useState } from "react";
import { adminApiRequest, useAdminRows } from "../../hooks/useAdminRows";
import "../admin/AdminPortal.css";

const STAGES = ["Pending Application", "Initial Screening", "Operations Interview", "Client Interview", "Offer Extended", "Hired & Onboarded", "Rejected"];

export default function HRDashboard({ authHeader, showToast }) {
  const applicants = useAdminRows("/applicants", authHeader);
  const postings = useAdminRows("/job-postings", authHeader);
  const [updating, setUpdating] = useState("");
  const [actionError, setActionError] = useState("");

  const updateApplicant = async (applicant, changes, message) => {
    setUpdating(String(applicant.id));
    setActionError("");
    try {
      await adminApiRequest(`/applicants/${applicant.id}`, authHeader, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      await applicants.reload();
      showToast(message);
    } catch (error) {
      setActionError(error.message || "Could not update applicant.");
    } finally {
      setUpdating("");
    }
  };

  const loading = applicants.loading || postings.loading;
  const error = applicants.error || postings.error || actionError;

  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <div>
          <h1>HR &amp; Recruitment Candidate Database</h1>
          <p>Review applicant stages and assign candidates to active job postings.</p>
        </div>
      </div>
      <div className="metrics-grid admin-metrics-grid">
        <div className="metric-card"><div className="metric-header">Active Sourcing Pipeline</div><div className="metric-value admin-metric-blue">{applicants.loading ? "—" : applicants.rows.length}</div></div>
        <div className="metric-card"><div className="metric-header">Active Job Postings</div><div className="metric-value">{postings.loading ? "—" : postings.rows.filter((posting) => posting.status === "Active").length}</div></div>
      </div>
      {error && <div className="admin-notice admin-notice-error" role="alert">{error}</div>}
      <div className="dash-card admin-table-card">
        {loading ? <div className="admin-notice">Loading applicant data…</div> : !applicants.rows.length ? <div className="admin-notice">No applicants are available.</div> : (
          <div className="table-responsive"><table>
            <thead><tr><th>Candidate ID</th><th>Name</th><th>Position</th><th>Current Stage</th><th>Assign Posting</th></tr></thead>
            <tbody>{applicants.rows.map((applicant) => (
              <tr key={applicant.id}>
                <td><strong>{applicant.id}</strong></td>
                <td>{applicant.name}</td>
                <td>{applicant.posting_title || applicant.job_offer || "—"}</td>
                <td>
                  <select
                    aria-label={`Update stage for ${applicant.name}`}
                    className="admin-stage-select"
                    disabled={updating === String(applicant.id)}
                    value={STAGES.includes(applicant.bpo_status) ? applicant.bpo_status : "Pending Application"}
                    onChange={(event) => updateApplicant(applicant, { bpo_status: event.target.value }, `Updated ${applicant.name}'s recruitment stage.`)}
                  >
                    {STAGES.map((stage) => <option key={stage}>{stage}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    aria-label={`Assign posting for ${applicant.name}`}
                    className="admin-stage-select"
                    disabled={updating === String(applicant.id)}
                    value={applicant.job_posting_id || ""}
                    onChange={(event) => updateApplicant(
                      applicant,
                      { job_posting_id: event.target.value || null },
                      event.target.value ? `Assigned ${applicant.name} to a job posting.` : `Removed ${applicant.name} from the posting.`
                    )}
                  >
                    <option value="">Not assigned</option>
                    {postings.rows.filter((posting) => posting.status === "Active" || String(posting.id) === String(applicant.job_posting_id)).map((posting) => (
                      <option key={posting.id} value={posting.id}>{posting.title} — {posting.department}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </section>
  );
}
