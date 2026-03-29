import express from "express";
import { uploadDocument } from "../controllers/documentController.js";
import upload from "../middlewares/uploadMiddleware.js";
import { extractDocumentText } from "../controllers/documentController.js";
import { generateNotes } from "../controllers/documentController.js";
import { getNotesByDocument } from "../controllers/documentController.js";




const router = express.Router();

// Upload PDF
router.post("/upload", upload.single("file"), uploadDocument);

router.get("/extract/:id", extractDocumentText);

router.post("/generate-notes/:id", generateNotes);

router.get("/notes/:id", getNotesByDocument);

export default router;