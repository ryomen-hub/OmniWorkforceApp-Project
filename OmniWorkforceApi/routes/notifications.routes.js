import { Router } from "express";
import * as notificationsController from "../controllers/notifications.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, notificationsController.getByUser);
router.patch("/:id/read", requireAuth, notificationsController.markRead);
router.patch("/read-all", requireAuth, notificationsController.markAllRead);
router.delete("/:id", requireAuth, notificationsController.remove);

export default router;
