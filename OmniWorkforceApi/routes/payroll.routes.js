import { Router } from "express";
import * as payrollController from "../controllers/payroll.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

// Matches Payroll Dashboard + ATS & Payroll Sync in the feature table —
// Admin and Payroll Officers only. Employee self-service payslips use the
// separate payroll-runs/me/payslips route with role-scoped access.
const canManagePayroll = requireRole(ROLES.ADMIN, ROLES.PAYROLL);

router.get("/", requireAuth, canManagePayroll, payrollController.getAll);
router.get("/:id", requireAuth, canManagePayroll, payrollController.getOne);
router.post("/", requireAuth, canManagePayroll, payrollController.create);
router.patch("/:id", requireAuth, canManagePayroll, payrollController.update);
router.delete("/:id", requireAuth, canManagePayroll, payrollController.remove);

export default router;
