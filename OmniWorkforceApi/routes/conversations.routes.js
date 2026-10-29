import { Router } from "express";
import * as conversationsController from "../controllers/conversations.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/colleagues", requireAuth, conversationsController.getColleagues);
router.get("/", requireAuth, conversationsController.getAll);
router.post("/", requireAuth, conversationsController.create);
router.get("/:id/messages", requireAuth, conversationsController.getMessages);
router.post("/:id/messages", requireAuth, conversationsController.createMessage);
router.patch("/:id/read", requireAuth, conversationsController.markRead);

export default router;
