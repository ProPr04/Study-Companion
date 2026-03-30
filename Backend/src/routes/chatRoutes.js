import express from "express";
import { askChatQuestion, refineChatAnswer } from "../controllers/chatController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/ask", authMiddleware, askChatQuestion);
router.post("/refine", authMiddleware, refineChatAnswer);

export default router;
