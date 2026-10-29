import { createRoot } from "react-dom/client";
import OmniWorkforceApp from "./OmniWorkforceApp";
import "./styles/tokens.css";
import "./styles/shared.css";
import "./components/auth/LoginView.css";
import "./components/layout/TopNavbar.css";
import "./components/layout/Sidebar.css";
import "./components/dashboard/ReferralDashboard.css";
import "./components/mainboard/MainBoard.css";
import "./components/mail/GmailPanel.css";
import "./components/mail/ComposeModal.css";
import "./components/shared/Toast.css";

createRoot(document.getElementById("app")).render(<OmniWorkforceApp />);
