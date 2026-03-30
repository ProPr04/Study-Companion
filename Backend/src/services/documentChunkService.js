import pool from "../db/index.js";
import { extractTextFromPDF } from "../utils/pdfParser.js";
import { cleanText, chunkText } from "../utils/textProcessor.js";

let documentChunksTableReady = false;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
]);

const SUMMARY_INTENT_KEYWORDS = [
  "summary",
  "summarize",
  "overview",
  "gist",
  "brief",
  "explain",
  "describe",
];

export const ensureDocumentChunksTable = async () => {
  if (documentChunksTableReady) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id SERIAL PRIMARY KEY,
      document_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL
    )
  `);

  documentChunksTableReady = true;
};

const tokenize = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token && token.length > 2 && !STOP_WORDS.has(token));

const scoreChunk = (questionTokens, chunkContent) => {
  const chunkTextValue = String(chunkContent ?? "").toLowerCase();

  return questionTokens.reduce((score, token) => {
    if (!chunkTextValue.includes(token)) {
      return score;
    }

    const exactMatches = chunkTextValue.split(token).length - 1;
    return score + exactMatches;
  }, 0);
};

const hasSummaryIntent = (question) => {
  const normalizedQuestion = String(question ?? "").toLowerCase();
  return SUMMARY_INTENT_KEYWORDS.some((keyword) => normalizedQuestion.includes(keyword));
};

export const syncDocumentChunks = async (document) => {
  await ensureDocumentChunksTable();

  const existingChunks = await pool.query(
    "SELECT id FROM document_chunks WHERE document_id = $1 AND user_id = $2 LIMIT 1",
    [document.id, document.user_id]
  );

  if (existingChunks.rows.length > 0) {
    return;
  }

  const rawText = await extractTextFromPDF(document.file_path);
  const cleanedText = cleanText(rawText);
  const chunks = chunkText(cleanedText, 1000)
    .map((chunk) => String(chunk ?? "").trim())
    .filter(Boolean)
    .slice(0, 60);

  if (chunks.length === 0) {
    return;
  }

  const placeholders = chunks
    .map((_, index) => {
      const offset = index * 3;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
    })
    .join(", ");

  const values = chunks.flatMap((chunk) => [document.id, document.user_id, chunk]);

  await pool.query(
    `INSERT INTO document_chunks (document_id, user_id, content) VALUES ${placeholders}`,
    values
  );
};

export const prepareChunksForUser = async ({ userId, documentId = null }) => {
  await ensureDocumentChunksTable();

  const documentsQuery = documentId
    ? {
        text: "SELECT id, user_id, file_name, file_path FROM documents WHERE user_id = $1 AND id = $2 ORDER BY created_at DESC",
        values: [userId, documentId],
      }
    : {
        text: "SELECT id, user_id, file_name, file_path FROM documents WHERE user_id = $1 ORDER BY created_at DESC LIMIT 12",
        values: [userId],
      };

  const documentsResult = await pool.query(documentsQuery.text, documentsQuery.values);
  const documents = documentsResult.rows;

  for (const document of documents) {
    await syncDocumentChunks(document);
  }

  return documents;
};

export const findRelevantChunks = async ({
  userId,
  question,
  documentId = null,
  limit = 4,
}) => {
  await ensureDocumentChunksTable();

  const chunkQuery = documentId
    ? {
        text: `
          SELECT dc.id, dc.document_id, dc.content, d.file_name
          FROM document_chunks dc
          JOIN documents d ON d.id = dc.document_id
          WHERE dc.user_id = $1 AND dc.document_id = $2 AND d.user_id = $1
        `,
        values: [userId, documentId],
      }
    : {
        text: `
          SELECT dc.id, dc.document_id, dc.content, d.file_name
          FROM document_chunks dc
          JOIN documents d ON d.id = dc.document_id
          WHERE dc.user_id = $1 AND d.user_id = $1
        `,
        values: [userId],
      };

  const result = await pool.query(chunkQuery.text, chunkQuery.values);
  const questionTokens = tokenize(question);

  const rankedChunks = result.rows
    .map((chunk) => ({
      ...chunk,
      relevance: scoreChunk(questionTokens, chunk.content),
    }))
    .filter((chunk) => chunk.relevance > 0)
    .sort((left, right) => right.relevance - left.relevance)
    .slice(0, limit);

  if (rankedChunks.length > 0) {
    return rankedChunks;
  }

  if (result.rows.length === 0) {
    return [];
  }

  if (documentId || questionTokens.length === 0 || hasSummaryIntent(question)) {
    return result.rows
      .slice()
      .sort((left, right) => {
        if (left.document_id !== right.document_id) {
          return left.document_id - right.document_id;
        }

        return left.id - right.id;
      })
      .slice(0, limit)
      .map((chunk) => ({
        ...chunk,
        relevance: 0,
      }));
  }

  return rankedChunks;
};
