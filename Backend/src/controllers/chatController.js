import {
  analyzeTutorInput,
  answerQuestionWithTutorContext,
  summarizeTutorResponse,
  verifyTutorResponse,
} from "../services/aiService.js";
import { findRelevantChunks, prepareChunksForUser } from "../services/documentChunkService.js";
import {
  buildTutorFallbackResponse,
  buildTutorPlan,
  getRecentChatTurns,
  getStudentProfile,
  getTutorMemory,
  saveTutorTurn,
  updateStudentProfile,
  updateTutorMemoryFromTurn,
} from "../services/tutorContextService.js";

const buildSources = (relevantChunks) =>
  relevantChunks.map((chunk) => ({
    id: chunk.id,
    documentId: chunk.document_id,
    fileName: chunk.file_name,
    excerpt: `${chunk.content.slice(0, 220)}${chunk.content.length > 220 ? "..." : ""}`,
  }));

const generateTutorReply = async ({
  userId,
  question,
  documentId,
  refinement = null,
}) => {
  const documents = await prepareChunksForUser({ userId, documentId });
  const relevantChunks = documents.length
    ? await findRelevantChunks({
        userId,
        question,
        documentId,
        limit: 4,
      })
    : [];

  const profile = await getStudentProfile(userId);
  const memory = await getTutorMemory(userId);
  const recentTurns = await getRecentChatTurns(userId, 6);
  const inputAnalysis = await analyzeTutorInput({
    question,
    profile,
    memory,
    recentTurns,
    refinement,
  });
  const planner = buildTutorPlan({
    profile,
    memory,
    inputAnalysis,
    refinement,
  });
  const buildGracefulVerification = (notes = []) => ({
    addressesTargetConcept: true,
    resolvesActiveConfusion: !inputAnalysis.confusionDetected,
    followsScaffoldStructure: true,
    usesMultihopReasoning: true,
    needsRegeneration: false,
    correctionNotes: notes,
    lowConfidence: true,
  });

  let answer = "";
  let verification = buildGracefulVerification();

  if (planner.shouldClarify || planner.shouldAcknowledgeResolution || inputAnalysis.misconceptionDetected) {
    answer = buildTutorFallbackResponse({
      question,
      inputAnalysis,
      planner,
      memory,
    });
    verification = buildGracefulVerification();
  } else {
    try {
      answer = await answerQuestionWithTutorContext({
        question,
        chunks: relevantChunks,
        profile,
        memory,
        recentTurns,
        planner,
        refinement,
      });

      verification = await verifyTutorResponse({
        question,
        answer,
        planner,
        inputAnalysis,
      });

      if (verification.needsRegeneration) {
        answer = await answerQuestionWithTutorContext({
          question,
          chunks: relevantChunks,
          profile,
          memory,
          recentTurns,
          planner,
          refinement,
          correctionNotes: verification.correctionNotes,
        });

        verification = await verifyTutorResponse({
          question,
          answer,
          planner,
          inputAnalysis,
        });
      }

      if (verification.needsRegeneration) {
        verification = {
          ...verification,
          needsRegeneration: false,
          lowConfidence: true,
          correctionNotes: [
            ...verification.correctionNotes,
            "Returned the best aligned answer instead of failing the request.",
          ],
        };
      }
    } catch (error) {
      console.error(error);
      answer = buildTutorFallbackResponse({
        question,
        inputAnalysis,
        planner,
        memory,
      });
      verification = buildGracefulVerification([
        "Used a local fallback because the tutor model was unavailable for this request.",
      ]);
    }
  }

  const responseSummary = await summarizeTutorResponse({
    question,
    answer,
    inputAnalysis,
  });
  const verifiedResponseSummary = {
    ...responseSummary,
    remainingGaps: verification.resolvesActiveConfusion
      ? responseSummary.remainingGaps
      : [
          planner.activeConfusion || planner.exactConceptToTeach || inputAnalysis.confusionTopic,
        ].filter(Boolean),
  };
  const nextMemory = updateTutorMemoryFromTurn({
    memory,
    inputAnalysis,
    responseSummary: verifiedResponseSummary,
    verification,
  });

  await saveTutorTurn({
    userId,
    question,
    answer,
    inputAnalysis,
    planner,
    responseSummary: verifiedResponseSummary,
    nextMemory,
  });

  return {
    answer,
    sources: buildSources(relevantChunks),
    tutorContext: {
      inputAnalysis,
      planner,
      responseSummary: verifiedResponseSummary,
      verification,
      profile,
      memory: nextMemory,
    },
  };
};

export const askChatQuestion = async (req, res) => {
  try {
    const userId = req.user.id;
    const question = String(req.body?.question ?? "").trim();
    const documentId = req.body?.documentId ? Number(req.body.documentId) : null;

    if (!question) {
      return res.status(400).json({ error: "Question is required." });
    }

    const result = await generateTutorReply({
      userId,
      question,
      documentId,
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to answer the question." });
  }
};

export const getChatProfile = async (req, res) => {
  try {
    const profile = await getStudentProfile(req.user.id);
    const memory = await getTutorMemory(req.user.id);

    res.json({
      profile,
      memory,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load tutor profile." });
  }
};

export const updateChatProfile = async (req, res) => {
  try {
    const profile = await updateStudentProfile(req.user.id, req.body ?? {});
    const memory = await getTutorMemory(req.user.id);

    res.json({
      message: "Tutor profile updated successfully",
      profile,
      memory,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update tutor profile." });
  }
};

export const refineChatAnswer = async (req, res) => {
  try {
    const userId = req.user.id;
    const type = String(req.body?.type ?? "").trim().toLowerCase();
    const question = String(req.body?.question ?? "").trim();
    const answer = String(req.body?.answer ?? "").trim();
    const documentId = req.body?.documentId ? Number(req.body.documentId) : null;

    if (!["simplify", "analogy", "deeper"].includes(type)) {
      return res.status(400).json({ error: "Invalid refine type." });
    }

    if (!question || !answer) {
      return res.status(400).json({ error: "Question and previous answer are required." });
    }

    const refineQuestion = {
      simplify: `Please simplify the previous explanation about "${question}" because I still need an easier version.`,
      analogy: `Please explain "${question}" again using a real-world analogy based on the previous explanation.`,
      deeper: `Please go deeper on "${question}" and expand the previous explanation with more reasoning.`,
    }[type];

    const result = await generateTutorReply({
      userId,
      question: refineQuestion,
      documentId,
      refinement: {
        type,
        originalQuestion: question,
        previousAnswer: answer,
      },
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to refine the answer." });
  }
};
