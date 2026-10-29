import { useState } from "react";
import LoginView from "./components/auth/LoginView";
import PasswordRecoveryView from "./components/auth/PasswordRecoveryView";
import TopNavbar from "./components/layout/TopNavbar";
import Sidebar from "./components/layout/Sidebar";
import ReferralDashboard from "./components/dashboard/ReferralDashboard";
import ApplicantsView from "./components/dashboard/ApplicantsView";
import HRDashboard from "./components/dashboard/HRDashboard";
import RecruitmentDashboard from "./components/dashboard/RecruitmentDashboard";
import EmployeeDashboard from "./components/dashboard/EmployeeDashboard";
import AdminDashboard from "./components/dashboard/AdminDashboard";
import AtsPipeline from "./components/ats/AtsPipeline";
import OwnPayslips from "./components/payroll/OwnPayslips";
import MainBoard from "./components/mainboard/MainBoard";
import GmailPanel from "./components/mail/GmailPanel";
import ComposeModal from "./components/mail/ComposeModal";
import Toast from "./components/shared/Toast";
import useAuth from "./hooks/useAuth";
import useNotifications from "./hooks/useNotifications";
import useToasts from "./hooks/useToasts";
import useEmails from "./hooks/useEmails";
import useMainBoard from "./hooks/useMainBoard";
import useSocket from "./hooks/useSocket";
import { ROLES, ALL_ROLES } from "./constants/roles";
import {
	AdminAtsSync,
	AdminHrDashboard,
	AdminPayrollDashboard,
	AdminTeamMessenger,
	AdminUsersPage,
} from "./components/admin/AdminPortal";

export default function OmniWorkforceApp() {
	const { toasts, showToast } = useToasts();
	const [activeNav, setActiveNav] = useState("main-dash");
	const [activeSubTab, setActiveSubTab] = useState("dashboard-view");
	const [composeOpen, setComposeOpen] = useState(false);
	const [composeRecipientRole, setComposeRecipientRole] = useState("");
	const [composeSubject, setComposeSubject] = useState("");
	const [composeBody, setComposeBody] = useState("");
	const [passwordResetToken, setPasswordResetToken] = useState(
		() => new URLSearchParams(window.location.search).get("resetToken") || ""
	);
	const auth = useAuth(showToast, () => setActiveNav("main-dash"));
	const { socket } = useSocket(auth.token);
	const notificationsState = useNotifications(auth.token, auth.authHeader, socket, showToast);
	const emails = useEmails(auth.token, auth.authHeader, socket, auth.role, showToast);
	const board = useMainBoard(auth.token, auth.authHeader, socket, showToast);
	const switchNavTab = (tab) => {
		setActiveNav(tab);
		if (tab === "messages") emails.setEmailFolder("inbox");
	};
	const handleSendEmail = async () => {
		const sent = await emails.sendEmail({
			recipientRole: composeRecipientRole,
			subject: composeSubject.trim(),
			body: composeBody.trim(),
		});
		if (!sent) return;
		setComposeOpen(false);
		setComposeRecipientRole("");
		setComposeSubject("");
		setComposeBody("");
	};
	const copyLink = (url) => navigator.clipboard?.writeText(url).then(
		() => showToast("Referral link copied to clipboard!"),
		() => showToast("Referral link copied to clipboard!")
	);
	const logout = () => {
		auth.logout();
		setActiveNav("main-dash");
		setActiveSubTab("dashboard-view");
	};
	const closePasswordRecovery = () => {
		window.history.replaceState({}, document.title, window.location.pathname);
		setPasswordResetToken("");
	};
	const subTabsVisible = activeNav === "main-dash"
		&& auth.role !== ROLES.ADMIN
		&& auth.role !== ROLES.RECRUITERS_HR
		&& auth.role !== ROLES.RECRUITMENT
		&& auth.role !== ROLES.EMPLOYEE;
	return (
		<div
			style={{ minHeight: "100vh" }}
			onClick={() => notificationsState.notifDropdownOpen && notificationsState.setNotifDropdownOpen(false)}
		>
			<div className="owf">
				{!auth.loggedIn ? passwordResetToken ? (
					<PasswordRecoveryView token={passwordResetToken} onBack={closePasswordRecovery} />
				) : <LoginView {...auth} /> : (
					<div id="appView">
						<TopNavbar
							role={auth.role}
							{...notificationsState}
							toggleNotifDropdown={(event) => {
								event.stopPropagation();
								notificationsState.setNotifDropdownOpen((open) => !open);
							}}
							logout={logout}
						/>
						<div className="app-body">
							<Sidebar role={auth.role} activeNav={activeNav} switchNavTab={switchNavTab} />
							<main className="main-content">
								{activeNav === "main-dash" && (
									<>
										{subTabsVisible && (
											<div className="sub-tabs">
												<button className={`sub-tab-btn ${activeSubTab === "dashboard-view" ? "active" : ""}`} onClick={() => setActiveSubTab("dashboard-view")}>Dashboard</button>
												<button className={`sub-tab-btn ${activeSubTab === "applicants-view" ? "active" : ""}`} onClick={() => setActiveSubTab("applicants-view")}>My Applicants</button>
											</div>
										)}
										{auth.role === ROLES.ADMIN && <AdminDashboard authHeader={auth.authHeader} showToast={showToast} />}
										{auth.role === ROLES.RECRUITERS_HR && <RecruitmentDashboard authHeader={auth.authHeader} />}
										{auth.role === ROLES.RECRUITMENT && <RecruitmentDashboard authHeader={auth.authHeader} />}
										{auth.role === ROLES.PAYROLL && <AdminPayrollDashboard authHeader={auth.authHeader} />}
										{auth.role === ROLES.EMPLOYEE && <EmployeeDashboard email={auth.loggedInEmail} navigate={switchNavTab} />}
										{auth.role !== ROLES.ADMIN && auth.role !== ROLES.RECRUITERS_HR && auth.role !== ROLES.RECRUITMENT && auth.role !== ROLES.EMPLOYEE && activeSubTab === "dashboard-view" && <ReferralDashboard copyLink={copyLink} />}
										{auth.role !== ROLES.ADMIN && auth.role !== ROLES.RECRUITERS_HR && auth.role !== ROLES.RECRUITMENT && auth.role !== ROLES.EMPLOYEE && activeSubTab === "applicants-view" && <ApplicantsView showToast={showToast} />}
									</>
								)}
								{activeNav === "admin-users" && auth.role === ROLES.ADMIN && <AdminUsersPage authHeader={auth.authHeader} showToast={showToast} />}
								{activeNav === "hr-users" && auth.role === ROLES.RECRUITERS_HR && (
									<AdminUsersPage
										authHeader={auth.authHeader}
										showToast={showToast}
										heading="Users & Profiles Directory"
										description="Browse staff accounts across the organization."
									/>
								)}
								{activeNav === "hr-candidates" && auth.role === ROLES.RECRUITERS_HR && <HRDashboard authHeader={auth.authHeader} showToast={showToast} />}
								{activeNav === "hr-payslips" && auth.role === ROLES.RECRUITERS_HR && <OwnPayslips authHeader={auth.authHeader} />}
								{activeNav === "hr-messenger" && auth.role === ROLES.RECRUITERS_HR && (
									<AdminTeamMessenger
										authHeader={auth.authHeader}
										loggedInEmail={auth.loggedInEmail}
										socket={socket}
									/>
								)}
								{activeNav === "recruitment-payslips" && auth.role === ROLES.RECRUITMENT && <OwnPayslips authHeader={auth.authHeader} />}
								{activeNav === "recruitment-messenger" && auth.role === ROLES.RECRUITMENT && (
									<AdminTeamMessenger
										authHeader={auth.authHeader}
										loggedInEmail={auth.loggedInEmail}
										socket={socket}
										colleaguesPath="/conversations/colleagues"
									/>
								)}
								{activeNav === "employee-payslips" && auth.role === ROLES.EMPLOYEE && <OwnPayslips authHeader={auth.authHeader} />}
								{activeNav === "employee-messenger" && auth.role === ROLES.EMPLOYEE && (
									<AdminTeamMessenger
										authHeader={auth.authHeader}
										loggedInEmail={auth.loggedInEmail}
										socket={socket}
										colleaguesPath="/conversations/colleagues"
									/>
								)}
								{activeNav === "admin-payroll" && auth.role === ROLES.ADMIN && <AdminPayrollDashboard authHeader={auth.authHeader} />}
								{activeNav === "admin-hr" && auth.role === ROLES.ADMIN && <AdminHrDashboard authHeader={auth.authHeader} showToast={showToast} />}
								{activeNav === "admin-ats" && auth.role === ROLES.ADMIN && <AdminAtsSync authHeader={auth.authHeader} showToast={showToast} />}
								{activeNav === "admin-messenger" && auth.role === ROLES.ADMIN && (
									<AdminTeamMessenger
										authHeader={auth.authHeader}
										loggedInEmail={auth.loggedInEmail}
										socket={socket}
									/>
								)}
								{activeNav === "payroll-messenger" && auth.role === ROLES.PAYROLL && (
									<AdminTeamMessenger
										authHeader={auth.authHeader}
										loggedInEmail={auth.loggedInEmail}
										socket={socket}
										colleaguesPath="/conversations/colleagues"
									/>
								)}
								{activeNav === "main-board" && <MainBoard {...board} />}
								{activeNav === "messages" && (
									<GmailPanel
										role={auth.role}
										emailFolder={emails.emailFolder}
										setEmailFolder={emails.setEmailFolder}
										emails={emails.emails}
										inboxUnreadCount={emails.inboxUnreadCount}
										emailHandleDisplay={emails.emailHandleDisplay}
										openEmail={emails.openEmail}
										openComposeModal={() => setComposeOpen(true)}
									/>
								)}
								{activeNav === "ats-pipeline" && <AtsPipeline authHeader={auth.authHeader} showToast={showToast} />}
							</main>
						</div>
					</div>
				)}
				<ComposeModal
					open={composeOpen}
					roles={ALL_ROLES}
					recipientRole={composeRecipientRole}
					setRecipientRole={setComposeRecipientRole}
					subject={composeSubject}
					setSubject={setComposeSubject}
					body={composeBody}
					setBody={setComposeBody}
					onClose={() => setComposeOpen(false)}
					onSend={handleSendEmail}
				/>
				<Toast toasts={toasts} />
			</div>
		</div>
	);
}
