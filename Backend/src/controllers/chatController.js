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

const DEFAULT_PROFILE = {
  level: "beginner",
  subject: "Data Structures and Algorithms",
  weakAreas: ["recursion", "memory management"],
  misconceptions: ["recursion is faster than iteration"],
};

const DEFAULT_MEMORY = {
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
};

const safeStep = async (label, action, fallback) => {
  try {
    return await action();
  } catch (error) {
    console.error(`[chat] ${label} failed:`, error);
    return fallback;
  }
};

const normalizeDocumentId = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericId = Number(value);
  return Number.isInteger(numericId) && numericId > 0 ? numericId : null;
};

const buildEmergencyTutorResponse = (question) => ({
  answer: [
    "1. Intuition",
    "I could not fully process that request, so here is a safe fallback response.",
    "",
    "2. How it works",
    `Your question was: ${String(question ?? "").trim() || "No question provided."}`,
    "",
    "3. Deep dive",
    "The tutor hit an internal issue while preparing context or saving conversation state.",
    "",
    "4. Common mistake",
    "This usually happens when one backend step throws after the request starts.",
    "",
    "5. Final takeaway",
    "Please try the question again. If it repeats, the backend logs now include the failing step.",
  ].join("\n"),
  sources: [],
  tutorContext: {
    inputAnalysis: {
      intent: "new_question",
      targetConcept: "",
      confusionDetected: false,
      confusionTopic: "",
      misconceptionDetected: false,
      misconceptionStatement: "",
      followUpConfidence: 0,
      needsClarification: false,
      clarificationReason: "",
      selfResolved: false,
      explicitTopicShift: false,
      questionAspects: [],
      lowConfidence: true,
    },
    planner: {
      mode: "fallback",
      exactConceptToTeach: "",
      explanationDepth: "beginner_full",
      shouldZoomIn: false,
      shouldClarify: false,
      shouldAcknowledgeResolution: false,
      shouldCorrectMisconception: false,
      misconceptionToCorrect: "",
      unresolvedConcepts: [],
      activeConfusion: "",
      weakAreaFocus: [],
      refinement: null,
    },
    responseSummary: {
      mainTopic: "",
      conceptsExplained: [],
      misconceptionAddressed: "",
      remainingGaps: [],
      lowConfidence: true,
    },
    verification: {
      addressesTargetConcept: false,
      resolvesActiveConfusion: true,
      followsScaffoldStructure: true,
      usesMultihopReasoning: false,
      needsRegeneration: false,
      correctionNotes: ["Emergency fallback response used because the backend hit an internal error."],
      lowConfidence: true,
    },
    profile: DEFAULT_PROFILE,
    memory: DEFAULT_MEMORY,
  },
});

const generateTutorReply = async ({
  userId,
  question,
  documentId,
  refinement = null,
}) => {
  try {
  const documents = await safeStep(
    "document preparation",
    () => prepareChunksForUser({ userId, documentId }),
    []
  );
  const relevantChunks = documents.length
    ? await safeStep(
        "chunk retrieval",
        () => findRelevantChunks({
          userId,
          question,
          documentId,
          limit: 4,
        }),
        []
      )
    : [];

  const profile = await safeStep("student profile lookup", () => getStudentProfile(userId), DEFAULT_PROFILE);
  const memory = await safeStep("tutor memory lookup", () => getTutorMemory(userId), DEFAULT_MEMORY);
  const recentTurns = await safeStep("recent turn lookup", () => getRecentChatTurns(userId, 6), []);
  const inputAnalysis = await safeStep(
    "input analysis",
    () => analyzeTutorInput({
      question,
      profile,
      memory,
      recentTurns,
      refinement,
    }),
    {
      intent: refinement ? "follow_up" : "new_question",
      targetConcept: "",
      confusionDetected: false,
      confusionTopic: "",
      misconceptionDetected: false,
      misconceptionStatement: "",
      followUpConfidence: refinement ? 0.7 : 0.2,
      needsClarification: false,
      clarificationReason: "",
      selfResolved: false,
      explicitTopicShift: false,
      questionAspects: [],
      lowConfidence: true,
    }
  );
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

  const responseSummary = await safeStep(
    "response summary",
    () => summarizeTutorResponse({
      question,
      answer,
      inputAnalysis,
    }),
    {
      mainTopic: planner.exactConceptToTeach || inputAnalysis.targetConcept || "",
      conceptsExplained: planner.exactConceptToTeach ? [planner.exactConceptToTeach] : [],
      misconceptionAddressed: planner.shouldCorrectMisconception ? planner.misconceptionToCorrect : "",
      remainingGaps: [],
      lowConfidence: true,
    }
  );
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

  await safeStep(
    "turn persistence",
    () => saveTutorTurn({
      userId,
      question,
      answer,
      inputAnalysis,
      planner,
      responseSummary: verifiedResponseSummary,
      nextMemory,
    }),
    nextMemory
  );

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
  } catch (error) {
    console.error("[chat] generateTutorReply failed:", error);
    return buildEmergencyTutorResponse(question);
  }
};

export const askChatQuestion = async (req, res) => {
  try {
    const userId = req.user.id;
    const question = String(req.body?.question ?? "").trim();
    const documentId = normalizeDocumentId(req.body?.documentId);

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
    res.json(buildEmergencyTutorResponse(req.body?.question));
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
    const documentId = normalizeDocumentId(req.body?.documentId);

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
