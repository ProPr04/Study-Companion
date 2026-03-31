import express from "express";
import {
  askChatQuestion,
  getChatProfile,
  refineChatAnswer,
  updateChatProfile,
} from "../controllers/chatController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/profile", authMiddleware, getChatProfile);
router.put("/profile", authMiddleware, updateChatProfile);
router.post("/ask", authMiddleware, askChatQuestion);
router.post("/refine", authMiddleware, refineChatAnswer);

export default router;
