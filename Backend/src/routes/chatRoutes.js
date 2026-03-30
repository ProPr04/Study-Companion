import express from "express";
import { askChatQuestion } from "../controllers/chatController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/ask", authMiddleware, askChatQuestion);

export default router;
