import pool from "../db/index.js";
import { extractTextFromPDF } from "../utils/pdfParser.js";
import { cleanText, chunkText } from "../utils/textProcessor.js";
import { generateNotesFromChunk } from "../services/aiService.js";

export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const file_name = req.file.originalname;
    const file_path = req.file.path;

    const result = await pool.query(
      "INSERT INTO documents (file_name, file_path) VALUES ($1, $2) RETURNING *",
      [file_name, file_path]
    );

    res.status(201).json({
      message: "File uploaded successfully",
      document: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Upload failed" });
  }
};




export const extractDocumentText = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "SELECT * FROM documents WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const filePath = result.rows[0].file_path;

    // Step 1: Extract raw text
    const rawText = await extractTextFromPDF(filePath);

    // Step 2: Clean text
    const cleanedText = cleanText(rawText);

    // Step 3: Chunk text
    const chunks = chunkText(cleanedText, 1000);

    res.json({
      message: "Text processed successfully",
      totalChunks: chunks.length,
      preview: chunks[0] // only show first chunk
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Processing failed" });
  }
};

export const generateNotes = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "SELECT * FROM documents WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const filePath = result.rows[0].file_path;

    // Extract + clean + chunk
    const rawText = await extractTextFromPDF(filePath);
    const cleanedText = cleanText(rawText);
    const chunks = chunkText(cleanedText, 1000);

    let finalNotes = "";

    for (let i = 0; i < chunks.length; i++) {
      console.log(`Processing chunk ${i + 1}/${chunks.length}`);

      const notes = await generateNotesFromChunk(chunks[i]);
      finalNotes += notes + "\n\n";
    }

    // ✅ STORE IN DATABASE
    const savedNotes = await pool.query(
      "INSERT INTO notes (document_id, content) VALUES ($1, $2) RETURNING *",
      [id, finalNotes]
    );

    res.json({
      message: "Notes generated and saved successfully",
      notes: savedNotes.rows[0],
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Notes generation failed" });
  }
};

export const getNotesByDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "SELECT * FROM notes WHERE document_id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No notes found" });
    }

    res.json({
      notes: result.rows,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch notes" });
  }
};