import "../admin/AdminPortal.css";

export default function EmployeeDashboard({ email, navigate }) {
  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <div>
          <h1>Agent / Employee Dashboard</h1>
          <p>Welcome{email ? `, ${email}` : ""}. Access your payslips and team communication.</p>
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="dash-card">
          <h2>My Payslip Details</h2>
          <p>View your paid payslips, pay periods, earnings, and deductions.</p>
          <button className="btn-primary btn-small" type="button" onClick={() => navigate("employee-payslips")}>View My Payslips</button>
        </section>
        <section className="dash-card">
          <h2>Team Messenger</h2>
          <p>Start or continue direct and group conversations with colleagues.</p>
          <button className="btn-primary btn-small" type="button" onClick={() => navigate("employee-messenger")}>Open Messenger</button>
        </section>
        <section className="dash-card">
          <h2>Department Email</h2>
          <p>Check your department inbox and send a message to another department.</p>
          <button className="btn-primary btn-small" type="button" onClick={() => navigate("messages")}>Open Email</button>
        </section>
      </div>
    </section>
  );
}
