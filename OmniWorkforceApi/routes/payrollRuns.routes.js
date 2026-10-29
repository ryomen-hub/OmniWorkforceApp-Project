import { Router } from "express";
import * as payrollRunsController from "../controllers/payrollRuns.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = Router();
const canManagePayroll = requireRole(ROLES.ADMIN, ROLES.PAYROLL);

router.get("/", requireAuth, canManagePayroll, payrollRunsController.getAll);
router.post("/", requireAuth, canManagePayroll, payrollRunsController.create);
router.get(
  "/me/payslips",
  requireAuth,
  requireRole(ROLES.RECRUITERS_HR, ROLES.RECRUITMENT, ROLES.EMPLOYEE),
  payrollRunsController.getMyPayslips
);
router.get("/:id", requireAuth, canManagePayroll, payrollRunsController.getOne);
router.patch("/:id/status", requireAuth, canManagePayroll, payrollRunsController.updateStatus);
router.patch("/:runId/payslips/:slipId", requireAuth, canManagePayroll, payrollRunsController.updatePayslipLines);

export default router;
