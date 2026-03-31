import pool from "../db/index.js";
import { extractTextFromPDF } from "../utils/pdfParser.js";
import { cleanText, chunkText } from "../utils/textProcessor.js";
import { generateNotesFromChunk, generateQuizFromText } from "../services/aiService.js";
import { ensureDocumentChunksTable, syncDocumentChunks } from "../services/documentChunkService.js";
import fs from "fs/promises";

let documentMetadataColumnsReady = false;
let quizResultsTableReady = false;

const ensureDocumentMetadataColumns = async () => {
  if (documentMetadataColumnsReady) {
    return;
  }

  await pool.query(`
    ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS class_name TEXT,
    ADD COLUMN IF NOT EXISTS subject TEXT
  `);

  documentMetadataColumnsReady = true;
};

const ensureQuizResultsTable = async () => {
  if (quizResultsTableReady) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS quiz_results (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      document_id INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      percentage INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  quizResultsTableReady = true;
};

export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    await ensureDocumentMetadataColumns();

    const userId = req.user.id;
    const file_name = req.file.originalname;
    const file_path = req.file.path;
    const class_name = String(req.body?.className ?? "").trim() || null;
    const subject = String(req.body?.subject ?? "").trim() || null;

    const result = await pool.query(
      `INSERT INTO documents (file_name, file_path, user_id, class_name, subject)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [file_name, file_path, userId, class_name, subject]
    );

    await syncDocumentChunks(result.rows[0]);

    res.status(201).json({
      message: "File uploaded successfully",
      docId: result.rows[0].id,
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
    const userId = req.user.id;

    const result = await pool.query(
      "SELECT * FROM documents WHERE id = $1 AND user_id = $2",
      [id, userId]
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
    const userId = req.user.id;

    const result = await pool.query(
      "SELECT * FROM documents WHERE id = $1 AND user_id = $2",
      [id, userId]
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
      "INSERT INTO notes (document_id, content, user_id) VALUES ($1, $2, $3) RETURNING *",
      [id, finalNotes, userId]
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
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT notes.*
      FROM notes
      JOIN documents ON documents.id = notes.document_id
      WHERE notes.document_id = $1 AND notes.user_id = $2 AND documents.user_id = $2
      ORDER BY notes.created_at DESC`,
      [id, userId]
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

export const getAllNotes = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(`
      SELECT notes.*, documents.file_name, documents.file_path 
      FROM notes
      JOIN documents ON notes.document_id = documents.id
      WHERE notes.user_id = $1 AND documents.user_id = $1
      ORDER BY notes.created_at DESC
    `, [userId]);

    res.json({
      notes: result.rows,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch notes" });
  }
};

export const getAllDocuments = async (req, res) => {
  try {
    await ensureDocumentMetadataColumns();

    const userId = req.user.id;
    const result = await pool.query(`
      SELECT
        documents.*,
        COUNT(notes.id)::int AS notes_count
      FROM documents
      LEFT JOIN notes ON notes.document_id = documents.id AND notes.user_id = documents.user_id
      WHERE documents.user_id = $1
      GROUP BY documents.id
      ORDER BY documents.created_at DESC
    `, [userId]);

    res.json({
      documents: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
};

export const getDocumentFile = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      "SELECT id, file_name, file_path FROM documents WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const document = result.rows[0];
    const safeFileName = String(document.file_name ?? "document.pdf").replace(/"/g, "");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${safeFileName}"`);

    return res.sendFile(document.file_path);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load document file" });
  }
};

export const deleteDocument = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const userId = req.user.id;

    await client.query("BEGIN");

    const documentResult = await client.query(
      "SELECT * FROM documents WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (documentResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Document not found" });
    }

    const document = documentResult.rows[0];

    await ensureDocumentChunksTable();

    const deletedNotesResult = await client.query(
      "DELETE FROM notes WHERE document_id = $1 AND user_id = $2 RETURNING id",
      [id, userId]
    );

    await ensureQuizResultsTable();

    await client.query(
      "DELETE FROM quiz_results WHERE document_id = $1 AND user_id = $2",
      [id, userId]
    );

    await client.query(
      "DELETE FROM document_chunks WHERE document_id = $1 AND user_id = $2",
      [id, userId]
    );

    await client.query(
      "DELETE FROM documents WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    await client.query("COMMIT");

    if (document.file_path) {
      try {
        await fs.unlink(document.file_path);
      } catch (fileError) {
        if (fileError.code !== "ENOENT") {
          console.error(fileError);
        }
      }
    }

    res.json({
      message: "Document and related notes deleted successfully",
      deletedDocumentId: Number(id),
      deletedNotesCount: deletedNotesResult.rowCount,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Failed to delete document" });
  } finally {
    client.release();
  }
};

export const generateQuizForDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const difficulty = String(req.body?.difficulty ?? "moderate").trim().toLowerCase();
    const questionCount = Number(req.body?.questionCount ?? 10);

    if (!Number.isInteger(questionCount) || questionCount < 1) {
      return res.status(400).json({ error: "Please choose at least 1 question." });
    }

    if (questionCount > 15) {
      return res.status(400).json({ error: "Only 15 questions can be created at once." });
    }

    const result = await pool.query(
      "SELECT * FROM documents WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const filePath = result.rows[0].file_path;
    const rawText = await extractTextFromPDF(filePath);
    const cleanedText = cleanText(rawText);

    if (!cleanedText || cleanedText.length < 200) {
      return res.status(400).json({
        error: "Document content is too short to create a quiz.",
      });
    }

    const quiz = await generateQuizFromText(cleanedText, difficulty, questionCount);

    res.json({
      message: "Quiz generated successfully",
      document: {
        id: result.rows[0].id,
        file_name: result.rows[0].file_name,
      },
      quiz,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate quiz" });
  }
};

export const saveQuizResult = async (req, res) => {
  try {
    await ensureQuizResultsTable();

    const { id } = req.params;
    const userId = req.user.id;
    const score = Number(req.body?.score);
    const totalQuestions = Number(req.body?.totalQuestions);
    const percentage = Number(req.body?.percentage);
    const difficulty = String(req.body?.difficulty ?? "moderate").trim().toLowerCase() || "moderate";

    if (!Number.isInteger(score) || !Number.isInteger(totalQuestions) || totalQuestions <= 0) {
      return res.status(400).json({ error: "Invalid quiz result payload" });
    }

    const result = await pool.query(
      "SELECT id FROM documents WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const safePercentage = Number.isInteger(percentage)
      ? percentage
      : Math.round((score / totalQuestions) * 100);

    const saveResult = await pool.query(
      `INSERT INTO quiz_results (user_id, document_id, difficulty, score, total_questions, percentage)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, id, difficulty, score, totalQuestions, safePercentage]
    );

    res.status(201).json({
      message: "Quiz result saved successfully",
      result: saveResult.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to save quiz result" });
  }
};

export const getQuizAnalysis = async (req, res) => {
  try {
    await ensureQuizResultsTable();

    const userId = req.user.id;
    const result = await pool.query(
      `SELECT
        quiz_results.*,
        documents.file_name
      FROM quiz_results
      JOIN documents ON documents.id = quiz_results.document_id
      WHERE quiz_results.user_id = $1 AND documents.user_id = $1
      ORDER BY quiz_results.created_at ASC`,
      [userId]
    );

    const attempts = result.rows.map((row, index) => ({
      ...row,
      attempt_number: index + 1,
    }));

    const totalAttempts = attempts.length;
    const averagePercentage = totalAttempts
      ? Math.round(
          attempts.reduce((sum, attempt) => sum + Number(attempt.percentage || 0), 0) / totalAttempts
        )
      : 0;
    const bestAttempt = attempts.reduce(
      (best, attempt) => {
        if (!best || Number(attempt.percentage) > Number(best.percentage)) {
          return attempt;
        }

        return best;
      },
      null
    );
    const latestAttempt = totalAttempts ? attempts[totalAttempts - 1] : null;

    res.json({
      attempts,
      summary: {
        totalAttempts,
        averagePercentage,
        bestPercentage: bestAttempt ? Number(bestAttempt.percentage) : 0,
        latestPercentage: latestAttempt ? Number(latestAttempt.percentage) : 0,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch quiz analysis" });
  }
};
