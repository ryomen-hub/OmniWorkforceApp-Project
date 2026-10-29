import { Router } from "express";
import * as applicantsController from "../controllers/applicants.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

// Viewing and creating (sourcing/referring) applicants matches everyone
// who has access to EITHER applicant-facing dashboard — Recruitment
// (job postings + read-only pipeline) or Recruiters & HR (the editable one)
const canSourceApplicants = requireRole(ROLES.ADMIN, ROLES.RECRUITERS_HR, ROLES.RECRUITMENT);

// Advancing a candidate's stage is narrower — only the Recruiters & HR
// Dashboard actually has the editable "Update Stage" control. Recruitment's
// dashboard is read-only, so Recruitment does NOT get this.
const canAdvanceStage = requireRole(ROLES.ADMIN, ROLES.RECRUITERS_HR);

router.get("/", requireAuth, canSourceApplicants, applicantsController.getAll);
router.get("/:id", requireAuth, canSourceApplicants, applicantsController.getOne);
router.post("/", requireAuth, canSourceApplicants, applicantsController.create);
router.patch("/:id", requireAuth, canAdvanceStage, applicantsController.update);

// Deleting an applicant record outright is a bigger action — Admin only
router.delete("/:id", requireAuth, requireRole(ROLES.ADMIN), applicantsController.remove);

export default router;
