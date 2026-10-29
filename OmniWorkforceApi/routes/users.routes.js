import { Router } from "express";
import * as usersController from "../controllers/users.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { ROLES } from "../constants/roles.js";

const router = Router();

// Public — this is how you GET a token in the first place, so it can't
// require one. Login is now email + password, no role picker.
router.post("/login", usersController.login);
router.post("/password/forgot", usersController.requestPasswordReset);
router.post("/password/reset", usersController.resetPassword);

// "Users & Profiles" — confirmed explicitly: Recruiters & HR gets the
// identical access Admin has here, not a narrower view-only version.
const canManageUsers = requireRole(ROLES.ADMIN, ROLES.RECRUITERS_HR);

router.get("/", requireAuth, canManageUsers, usersController.getAll);
router.get("/:id", requireAuth, canManageUsers, usersController.getOne);
router.post("/", requireAuth, canManageUsers, usersController.create);
router.patch("/:id", requireAuth, canManageUsers, usersController.update);
router.delete("/:id", requireAuth, canManageUsers, usersController.remove);

// Password reset is kept Admin Office ONLY, narrower than the rest of this
// file — not yet confirmed that HR should be able to reset anyone's
// password (including Admin's own). This is the one place I didn't
// extend "same as Admin" automatically; flag if HR should have this too.
router.patch("/:id/password", requireAuth, requireRole(ROLES.ADMIN), usersController.changePassword);

export default router;
