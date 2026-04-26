import {
  answerQuestionWithContext,
  refineAnswerWithContext,
} from "../services/aiService.js";
import { findRelevantChunks, prepareChunksForUser } from "../services/documentChunkService.js";
import { getStudentProfile, updateStudentProfile } from "../services/tutorContextService.js";

const DEFAULT_PROFILE = {
  level: "beginner",
  subject: "Data Structures and Algorithms",
  weakAreas: ["recursion", "memory management"],
  misconceptions: ["recursion is faster than iteration"],
};

const normalizeDocumentId = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericId = Number(value);
  return Number.isInteger(numericId) && numericId > 0 ? numericId : null;
};

const buildSources = (relevantChunks) =>
  relevantChunks.map((chunk) => ({
    id: chunk.id,
    documentId: chunk.document_id,
    fileName: chunk.file_name,
    excerpt: `${chunk.content.slice(0, 220)}${chunk.content.length > 220 ? "..." : ""}`,
  }));

const getRelevantChunksForQuestion = async ({
  userId,
  question,
  documentId,
}) => {
  await prepareChunksForUser({ userId, documentId });

  return findRelevantChunks({
    userId,
    question,
    documentId,
    limit: 4,
  });
};

export const askChatQuestion = async (req, res) => {
  try {
    const userId = req.user.id;
    const question = String(req.body?.question ?? "").trim();
    const documentId = normalizeDocumentId(req.body?.documentId);

    if (!question) {
      return res.status(400).json({ error: "Question is required." });
    }

    const relevantChunks = await getRelevantChunksForQuestion({
      userId,
      question,
      documentId,
    });

    const answer = await answerQuestionWithContext({
      question,
      chunks: relevantChunks,
    });

    return res.json({
      answer,
      sources: buildSources(relevantChunks),
    });
  } catch (error) {
    console.error("[chat] askChatQuestion failed:", error);
    return res.status(500).json({ error: "Could not answer the question right now." });
  }
};

export const refineChatAnswer = async (req, res) => {
  try {
    const userId = req.user.id;
    const type = String(req.body?.type ?? "").trim().toLowerCase();
    const answer = String(req.body?.answer ?? "").trim();
    const question = String(req.body?.question ?? "").trim();
    const documentId = normalizeDocumentId(req.body?.documentId);

    if (!["simplify", "analogy", "deeper"].includes(type)) {
      return res.status(400).json({ error: "Invalid refine type." });
    }

    if (!answer || !question) {
      return res.status(400).json({ error: "Question and previous answer are required." });
    }

    const relevantChunks = await getRelevantChunksForQuestion({
      userId,
      question,
      documentId,
    });

    const refinedAnswer = await refineAnswerWithContext({
      type,
      answer,
      chunks: relevantChunks,
    });

    return res.json({
      answer: refinedAnswer,
      sources: buildSources(relevantChunks),
    });
  } catch (error) {
    console.error("[chat] refineChatAnswer failed:", error);
    return res.status(500).json({ error: "Could not refine the answer right now." });
  }
};

export const getChatProfile = async (req, res) => {
  try {
    const profile = await getStudentProfile(req.user.id);

    return res.json({
      profile,
      memory: {
        lastTopic: "",
        explainedConcepts: [],
        unresolvedConcepts: [],
        activeConfusion: "",
        detectedMisconceptions: [],
        previousResponseSummary: {
          mainTopic: "",
          conceptsExplained: [],
          misconceptionAddressed: "",
          remainingGaps: [],
        },
      },
    });
  } catch (error) {
    console.error(error);
    return res.json({
      profile: DEFAULT_PROFILE,
      memory: {
        lastTopic: "",
        explainedConcepts: [],
        unresolvedConcepts: [],
        activeConfusion: "",
        detectedMisconceptions: [],
        previousResponseSummary: {
          mainTopic: "",
          conceptsExplained: [],
          misconceptionAddressed: "",
          remainingGaps: [],
        },
      },
    });
  }
};

export const updateChatProfile = async (req, res) => {
  try {
    const profile = await updateStudentProfile(req.user.id, req.body ?? {});

    return res.json({
      message: "Chat profile updated successfully",
      profile,
      memory: {
        lastTopic: "",
        explainedConcepts: [],
        unresolvedConcepts: [],
        activeConfusion: "",
        detectedMisconceptions: [],
        previousResponseSummary: {
          mainTopic: "",
          conceptsExplained: [],
          misconceptionAddressed: "",
          remainingGaps: [],
        },
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to update chat profile." });
  }
};
