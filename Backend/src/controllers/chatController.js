import { answerQuestionWithContext } from "../services/aiService.js";
import { findRelevantChunks, prepareChunksForUser } from "../services/documentChunkService.js";

export const askChatQuestion = async (req, res) => {
  try {
    const userId = req.user.id;
    const question = String(req.body?.question ?? "").trim();
    const documentId = req.body?.documentId ? Number(req.body.documentId) : null;

    if (!question) {
      return res.status(400).json({ error: "Question is required." });
    }

    const documents = await prepareChunksForUser({ userId, documentId });

    if (documents.length === 0) {
      return res.status(404).json({ error: "No uploaded documents were found for chat." });
    }

    const relevantChunks = await findRelevantChunks({
      userId,
      question,
      documentId,
      limit: 4,
    });

    if (relevantChunks.length === 0) {
      return res.json({
        answer: "I don't know based on the provided documents.",
        sources: [],
      });
    }

    const answer = await answerQuestionWithContext({
      question,
      chunks: relevantChunks,
    });

    res.json({
      answer,
      sources: relevantChunks.map((chunk) => ({
        id: chunk.id,
        documentId: chunk.document_id,
        fileName: chunk.file_name,
        excerpt: `${chunk.content.slice(0, 220)}${chunk.content.length > 220 ? "..." : ""}`,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to answer the question." });
  }
};
