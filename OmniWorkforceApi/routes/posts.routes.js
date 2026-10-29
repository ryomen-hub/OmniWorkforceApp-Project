import { Router } from "express";
import * as postsController from "../controllers/posts.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

// The feed itself is part of the shared "Integrated System Modules" hub —
// every logged-in role can view it, no role restriction beyond being
// authenticated at all.
router.get("/", requireAuth, postsController.getAll);
router.post("/:id/reactions", requireAuth, postsController.toggleReaction);

// Writing an announcement is narrower — matches "Post Announcement" in the
// feature table: Admin, Recruiters & HR, and Payroll Officers only.
// Recruitment and Agent/Employee can read the feed but not post to it.
router.post("/", requireAuth, requireRole(ROLES.ADMIN, ROLES.RECRUITERS_HR, ROLES.PAYROLL), postsController.create);

// Removing someone else's announcement is an Admin action
router.delete("/:id", requireAuth, requireRole(ROLES.ADMIN), postsController.remove);

export default router;
