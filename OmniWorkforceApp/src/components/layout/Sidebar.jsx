import Icon from "../shared/Icon";
import { ROLES } from "../../constants/roles";

export default function Sidebar({ role, activeNav, switchNavTab }) {
	const item = (id, label, icon) => (
		<div
			className={`nav-item ${activeNav === id ? "active" : ""}`}
			onClick={() => switchNavTab(id)}
			key={id}
		>
			<Icon>{icon}</Icon>
			<span>{label}</span>
		</div>
	);
	const dashboardIcon = <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>;
	const feedIcon = <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />;
	const mailIcon = <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>;
	const atsIcon = <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>;
	const usersIcon = <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>;
	const payrollIcon = <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 8h10M7 12h4M7 16h6" /></>;

	return (
		<aside className="sidebar">
			{role === ROLES.ADMIN ? (
				<>
					{item("admin-users", "Users & Profiles Directory", usersIcon)}
					{item("admin-payroll", "Payroll Officers Dashboard", payrollIcon)}
					{item("admin-hr", "Recruiters & HR Dashboard", usersIcon)}
					{item("main-board", "Main Board Feed", feedIcon)}
					{item("messages", "Department Email", mailIcon)}
					{item("admin-ats", "ATS & Payroll Sync", atsIcon)}
					{item("main-dash", "Recruitment Dashboard", dashboardIcon)}
					{item("admin-messenger", "Team Messenger", mailIcon)}
				</>
			) : (
				<>
					{item("main-dash", role === ROLES.RECRUITERS_HR ? "Recruitment Dashboard" : role ? `${role} Dashboard` : "Dashboard", dashboardIcon)}
					{role === ROLES.RECRUITERS_HR && item("hr-users", "Users & Profiles Directory", usersIcon)}
					{role === ROLES.RECRUITERS_HR && item("hr-candidates", "HR & Recruiters Dashboard", usersIcon)}
					{role === ROLES.RECRUITERS_HR && item("hr-payslips", "Own Payslip", payrollIcon)}
					{item("main-board", "Main Board Feed", feedIcon)}
					{item("messages", "Department Email", mailIcon)}
					{role === ROLES.RECRUITERS_HR && item("hr-messenger", "Team Messenger", mailIcon)}
					{role === ROLES.RECRUITMENT && item("recruitment-payslips", "Own Payslip", payrollIcon)}
					{role === ROLES.RECRUITMENT && item("recruitment-messenger", "Team Messenger", mailIcon)}
					{role === ROLES.PAYROLL && item("ats-pipeline", "ATS & Payroll Sync", atsIcon)}
					{role === ROLES.PAYROLL && item("payroll-messenger", "Team Messenger", mailIcon)}
					{role === ROLES.EMPLOYEE && item("employee-payslips", "Own Payslip Details", payrollIcon)}
					{role === ROLES.EMPLOYEE && item("employee-messenger", "Team Messenger", mailIcon)}
				</>
			)}
		</aside>
	);
}
