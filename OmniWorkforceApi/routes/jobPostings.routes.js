import { Router } from "express";
import * as jobPostingsController from "../controllers/jobPostings.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = Router();
const canManagePostings = requireRole(ROLES.ADMIN);
const canViewPostings = requireRole(ROLES.ADMIN, ROLES.RECRUITERS_HR, ROLES.RECRUITMENT);

router.get("/", requireAuth, canViewPostings, jobPostingsController.getAll);
router.post("/", requireAuth, canManagePostings, jobPostingsController.create);
router.patch("/:id", requireAuth, canManagePostings, jobPostingsController.update);
router.delete("/:id", requireAuth, canManagePostings, jobPostingsController.remove);
router.delete("/:id", requireAuth, canManagePostings, jobPostingsController.remove);

export default router;
