import express from "express";
import { uploadDocument } from "../controllers/documentController.js";
import upload from "../middlewares/uploadMiddleware.js";
import { extractDocumentText } from "../controllers/documentController.js";
import { generateNotes } from "../controllers/documentController.js";
import { getNotesByDocument } from "../controllers/documentController.js";
import { getAllNotes } from "../controllers/documentController.js";
import { getAllDocuments } from "../controllers/documentController.js";
import { deleteDocument } from "../controllers/documentController.js";
import { generateQuizForDocument } from "../controllers/documentController.js";
import { getDocumentFile } from "../controllers/documentController.js";
import { saveQuizResult } from "../controllers/documentController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Upload PDF
router.post("/upload",authMiddleware, upload.single("file"), uploadDocument);

router.get("/", authMiddleware, getAllDocuments);
router.get("/extract/:id",authMiddleware, extractDocumentText);

router.post("/generate-notes/:id",authMiddleware, generateNotes);
router.post("/quiz/:id",authMiddleware, generateQuizForDocument);
router.post("/quiz/:id/result", authMiddleware, saveQuizResult);
router.get("/:id/file", authMiddleware, getDocumentFile);

router.get("/notes/all",authMiddleware, getAllNotes);
router.get("/notes/:id", authMiddleware,getNotesByDocument);
router.delete("/:id",authMiddleware, deleteDocument);

export default router;
