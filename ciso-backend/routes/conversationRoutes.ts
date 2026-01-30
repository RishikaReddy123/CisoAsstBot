import { Router } from "express";
import {
  getAllConversations,
  getConversation,
  createConversation,
  appendMessage,
} from "../controllers/conversationController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", authMiddleware, getAllConversations);
router.get("/:id", authMiddleware, getConversation);
router.post("/", authMiddleware, createConversation);
router.post("/:id", authMiddleware, appendMessage);
router.patch("/:id", authMiddleware, appendMessage);

export default router;
