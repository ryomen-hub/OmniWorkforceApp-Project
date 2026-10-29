import { useAdminRows } from "../../hooks/useAdminRows";
import StatusPill from "../shared/StatusPill";
import "../admin/AdminPortal.css";
import "./PayrollWorkspace.css";

function currency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount);
}

function displayDate(value) {
  if (!value) return "—";
  return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString();
}

function PayslipLines({ label, items }) {
  return (
    <section className="own-payslip-lines">
      <h3>{label}</h3>
      {items?.length ? (
        <ul>{items.map((item, index) => (
          <li key={`${item.label}-${index}`}><span>{item.label}</span><strong>{currency(item.amount)}</strong></li>
        ))}</ul>
      ) : <p>No {label.toLowerCase()} recorded.</p>}
    </section>
  );
}

export default function OwnPayslips({ authHeader }) {
  const { rows: payslips, loading, error } = useAdminRows("/payroll-runs/me/payslips", authHeader);

  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <div>
          <h1>My Payslip Details</h1>
          <p>View your finalized payslip details.</p>
        </div>
      </div>
      {error && <div className="admin-notice admin-notice-error" role="alert">{error}</div>}
      {loading ? <div className="dash-card admin-notice">Loading your payslips…</div> : !error && payslips.length === 0 ? (
        <div className="dash-card admin-notice">No paid payslips are linked to this account yet. Contact Payroll if you think this is incorrect.</div>
      ) : (
        <div className="payroll-slip-list">
          {payslips.map((slip) => (
            <article className="dash-card payroll-slip-card own-payslip-card" key={slip.id}>
              <div className="payroll-slip-heading">
                <div>
                  <h2>{slip.employee_name}</h2>
                  <p>{slip.employee_code} · {slip.position || "Position unavailable"}</p>
                </div>
                <StatusPill type="verified">{slip.status}</StatusPill>
              </div>
              <div className="own-payslip-period">
                <span>Pay period <strong>{displayDate(slip.period_start)} – {displayDate(slip.period_end)}</strong></span>
                <span>Payout date <strong>{displayDate(slip.payout_date)}</strong></span>
              </div>
              <div className="payroll-slip-summary">
                <span>Monthly base salary<strong>{currency(slip.monthly_base_salary)}</strong></span>
                <span>Basic pay<strong>{currency(slip.basic_pay)}</strong></span>
                <span>Gross pay<strong>{currency(slip.gross_pay)}</strong></span>
                <span>Total deductions<strong>{currency(slip.total_deductions)}</strong></span>
                <span>Net pay<strong>{currency(slip.net_pay)}</strong></span>
              </div>
              <div className="own-payslip-detail-grid">
                <PayslipLines label="Earnings" items={slip.earnings} />
                <PayslipLines label="Deductions" items={slip.deductions} />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
