import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { askBot } from "../controllers/askController.js";

const router = Router();

router.post("/", authMiddleware, askBot);

export default router;
