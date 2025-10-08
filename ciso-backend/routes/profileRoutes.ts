import { Router } from "express";
import {
  getProfiles,
  getProfileById,
} from "../controllers/profileController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", authMiddleware, getProfiles);
router.get("/:id", authMiddleware, getProfileById);

export default router;
