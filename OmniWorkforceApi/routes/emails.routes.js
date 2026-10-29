import { Router } from "express";
import * as emailsController from "../controllers/emails.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

// No role restriction beyond "must be logged in" — the actual privacy
// boundary (only your own department's inbox) is enforced inside the
// controller/model using req.user, not here
router.get("/", requireAuth, emailsController.getByFolder);
router.post("/", requireAuth, emailsController.create);
router.patch("/:id/read", requireAuth, emailsController.markRead);
router.delete("/:id", requireAuth, emailsController.remove);

export default router;
