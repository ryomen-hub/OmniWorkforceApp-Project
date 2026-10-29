import { useMemo } from "react";
import { useAdminRows } from "../../hooks/useAdminRows";
import StatusPill from "../shared/StatusPill";
import "../admin/AdminPortal.css";

export default function RecruitmentDashboard({ authHeader }) {
  const applicants = useAdminRows("/applicants", authHeader);
  const postings = useAdminRows("/job-postings", authHeader);
  const activePostings = useMemo(
    () => postings.rows.filter((posting) => posting.status === "Active"),
    [postings.rows]
  );
  const hiredCount = applicants.rows.filter((applicant) =>
    /hired|onboard/i.test(applicant.bpo_status || "")
  ).length;
  const error = applicants.error || postings.error;

  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <div>
          <h1>Recruitment Dashboard</h1>
          <p>Review active job postings and follow candidates through the hiring pipeline.</p>
        </div>
      </div>
      <div className="metrics-grid admin-dashboard-metrics">
        <div className="metric-card">
          <div className="metric-header">Active Job Postings</div>
          <div className="metric-value admin-metric-blue">{postings.loading ? "—" : activePostings.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-header">Candidates in Pipeline</div>
          <div className="metric-value">{applicants.loading ? "—" : applicants.rows.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-header">Hired &amp; Onboarded</div>
          <div className="metric-value admin-metric-purple">{applicants.loading ? "—" : hiredCount}</div>
        </div>
      </div>
      {error && <div className="admin-notice admin-notice-error" role="alert">{error}</div>}

      <section className="dash-card admin-dashboard-card">
        <h2>Active Job Postings</h2>
        <p>Posting details are managed by Admin; HR can review the live pipeline here.</p>
        {postings.loading ? <div className="admin-notice">Loading postings…</div> : postings.error ? null : activePostings.length === 0 ? (
          <div className="admin-notice">No active job postings are available.</div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead><tr><th>Job Title</th><th>Department</th><th>Applicants</th><th>Status</th></tr></thead>
              <tbody>{activePostings.map((posting) => (
                <tr key={posting.id}>
                  <td><strong>{posting.title}</strong></td>
                  <td>{posting.department}</td>
                  <td><strong className="admin-count-link">{posting.applicant_count} candidates</strong></td>
                  <td><StatusPill type="verified">{posting.status}</StatusPill></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dash-card admin-dashboard-card">
        <h2>Candidate Pipeline Overview</h2>
        {applicants.loading ? <div className="admin-notice">Loading candidate data…</div> : applicants.error ? null : applicants.rows.length === 0 ? (
          <div className="admin-notice">No candidates are in the pipeline.</div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead><tr><th>Candidate ID</th><th>Name</th><th>Position</th><th>Current Stage</th></tr></thead>
              <tbody>{applicants.rows.map((applicant) => {
                const stage = applicant.bpo_status || "Pending Application";
                const statusType = /hired|onboard/i.test(stage) ? "verified" : /interview/i.test(stage) ? "interview" : "pending";
                return (
                  <tr key={applicant.id}>
                    <td><strong className="admin-count-link">{applicant.id}</strong></td>
                    <td><strong>{applicant.name}</strong></td>
                    <td>{applicant.posting_title || applicant.job_offer || "—"}</td>
                    <td><StatusPill type={statusType}>{stage}</StatusPill></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
