import { useMemo, useState } from "react";
import { useAdminRows } from "../../hooks/useAdminRows";
import StatusPill from "../shared/StatusPill";
import PayrollWorkspace from "../payroll/PayrollWorkspace";
import "../admin/AdminPortal.css";

export default function PayrollAtsSync({ authHeader, showToast }) {
  const { rows: payroll, loading, error } = useAdminRows("/payroll", authHeader);
  const [activeTab, setActiveTab] = useState("payslips");
  const [search, setSearch] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const query = search.trim().toLowerCase();
  const visiblePayroll = useMemo(
    () => payroll.filter((record) =>
      !query || [
        record.employee_code,
        record.applicant_name,
        record.applicant_email,
        record.position,
        record.applicant_job_offer,
        record.recruitment_stage,
      ].some((value) => String(value || "").toLowerCase().includes(query))
    ),
    [payroll, query]
  );

  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <div>
          <h1>ATS &amp; Payroll Sync Data</h1>
          <p>Review payslips, payroll sync status, and recruitment handover information.</p>
        </div>
      </div>
      <div className="admin-tabs" role="tablist" aria-label="ATS and payroll views">
        {[
          ["payslips", "Payslips"],
          ["monitoring", "Monitoring Table"],
          ["recruitment", "Recruitment Process"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={activeTab === id ? "active" : ""}
            onClick={() => setActiveTab(id)}
          >{label}</button>
        ))}
      </div>

      {activeTab === "payslips" ? (
        <PayrollWorkspace authHeader={authHeader} showToast={showToast} />
      ) : (
        <>
          <div className="admin-search-wrap">
            <input
              className="admin-search"
              type="search"
              placeholder="Search employee, ID, or position…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {error && <div className="admin-notice admin-notice-error" role="alert">{error}</div>}
          <div className="dash-card admin-table-card">
            {loading ? <div className="admin-notice">Loading payroll sync data…</div> : !error && visiblePayroll.length === 0 ? (
              <div className="admin-notice">No payroll records match this search.</div>
            ) : activeTab === "monitoring" ? (
              <div className="table-responsive">
                <table>
                  <thead><tr><th>Employee ID</th><th>Full Name</th><th>Contact</th><th>Last Synced</th><th>Sync Status</th></tr></thead>
                  <tbody>{visiblePayroll.map((record) => (
                    <tr key={record.id}>
                      <td><strong>{record.employee_code || "—"}</strong></td>
                      <td>{record.applicant_name || "Name unavailable"}</td>
                      <td>{record.applicant_email || "—"}</td>
                      <td>{record.created_at ? new Date(record.created_at).toLocaleString() : "—"}</td>
                      <td><StatusPill type={/auto.?synced/i.test(record.status || "") ? "verified" : "pending"}>{record.status || "Needs review"}</StatusPill></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : (
              <div className="table-responsive">
                <table>
                  <thead><tr><th>Employee ID</th><th>Full Name</th><th>Position</th><th>Recruitment Stage</th><th>Action</th></tr></thead>
                  <tbody>{visiblePayroll.map((record) => (
                    <tr key={record.id}>
                      <td><strong>{record.employee_code || "—"}</strong></td>
                      <td>{record.applicant_name || "Name unavailable"}</td>
                      <td>{record.position || record.applicant_job_offer || "—"}</td>
                      <td><StatusPill type={/hired|onboard/i.test(record.recruitment_stage || "") ? "verified" : /interview/i.test(record.recruitment_stage || "") ? "interview" : "pending"}>{record.recruitment_stage || "Not available"}</StatusPill></td>
                      <td><button className="admin-secondary-btn" type="button" onClick={() => setSelectedRecord(record)}>View ATS Profile</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
          {activeTab === "recruitment" && selectedRecord && (
            <section className="admin-ats-profile">
              <button className="admin-close-btn" aria-label="Close ATS profile" onClick={() => setSelectedRecord(null)}>×</button>
              <h2>{selectedRecord.applicant_name || "Employee profile"}</h2>
              <dl>
                <div><dt>Employee ID</dt><dd>{selectedRecord.employee_code || "—"}</dd></div>
                <div><dt>Email</dt><dd>{selectedRecord.applicant_email || "Not provided"}</dd></div>
                <div><dt>Position</dt><dd>{selectedRecord.position || selectedRecord.applicant_job_offer || "Not specified"}</dd></div>
                <div><dt>Recruitment stage</dt><dd>{selectedRecord.recruitment_stage || "Not available"}</dd></div>
              </dl>
            </section>
          )}
        </>
      )}
    </section>
  );
}
