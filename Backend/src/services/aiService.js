import "../config/env.js";
import { chunkText } from "../utils/textProcessor.js";
import { buildPrompt } from "../utils/buildPrompt.js";
import { buildTutorPrompt } from "./tutorContextService.js";

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").trim();
const OLLAMA_MODEL = (process.env.OLLAMA_MODEL || "gemma3:4b").trim();

const chatWithOllama = async ({
  messages,
  temperature = 0.2,
  format,
}) => {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      messages,
      options: {
        temperature,
      },
      ...(format ? { format } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data?.message?.content?.trim() ?? "";
};

export { buildPrompt };

const quizDifficultyConfig = {
  easy: {
    label: "easy",
    guidance: "Use straightforward recall and basic understanding questions. Keep distractors simple and clear.",
  },
  moderate: {
    label: "moderate",
    guidance: "Mix recall with application and comparison questions. Distractors should be plausible.",
  },
  advanced: {
    label: "advanced",
    guidance: "Favor analysis, inference, multi-step reasoning, and nuanced distinctions. Distractors should be strong.",
  },
};

export const generateNotesFromChunk = async (chunk) => {
  try {
    return await chatWithOllama({
      messages: [
        {
          role: "system",
          content: "You are a helpful study assistant.",
        },
        {
          role: "user",
          content: `
Convert the following text into concise study notes:
- Use bullet points
- Keep it simple and clear
- Highlight key concepts
- Avoid unnecessary details

TEXT:
${chunk}
          `,
        },
      ],
      temperature: 0.5,
    });
  } catch (error) {
    console.error("Ollama AI error:", error);
    throw new Error("AI generation failed");
  }
};

const parseJsonResponse = (content) => {
  const cleaned = content
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(cleaned);
};

const completeStructuredJson = async ({
  systemContent,
  userContent,
  temperature = 0.1,
}) => {
  const content = await chatWithOllama({
    temperature,
    messages: [
      {
        role: "system",
        content: systemContent,
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    format: "json",
  });

  return parseJsonResponse(content || "{}");
};

const normalizeQuiz = (quiz, questionCount = 10) => {
  const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];

  return {
    title: typeof quiz?.title === "string" && quiz.title.trim()
      ? quiz.title.trim()
      : "Generated Quiz",
    description: typeof quiz?.description === "string"
      ? quiz.description.trim()
      : "Quiz generated from the selected document.",
    questions: questions.slice(0, questionCount).map((question, index) => ({
      id: `q-${index + 1}`,
      question: String(question?.question ?? "").trim(),
      options: Array.isArray(question?.options)
        ? question.options.slice(0, 4).map((option) => String(option).trim())
        : [],
      correctAnswer: Number(question?.correctAnswer),
      explanation: String(question?.explanation ?? "").trim(),
    })).filter((question) =>
      question.question &&
      question.options.length === 4 &&
      question.options.every(Boolean) &&
      Number.isInteger(question.correctAnswer) &&
      question.correctAnswer >= 0 &&
      question.correctAnswer < 4
    ),
  };
};

const generateQuizSourceFromChunk = async (chunk, index, totalChunks) => {
  return chatWithOllama({
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `You are helping prepare a quiz source packet from study material.
Return plain text only.
Extract only the most important facts, terms, relationships, processes, and definitions from the chunk.
Do not use outside knowledge.
Do not add information not present in the chunk.
Keep the result concise and easy to turn into quiz questions.`,
      },
      {
        role: "user",
        content: `Chunk ${index + 1} of ${totalChunks}

Create a concise study-point summary from this chunk only:

${chunk}`,
      },
    ],
  });
};

export const generateQuizFromText = async (
  text,
  difficulty = "moderate",
  questionCount = 10
) => {
  try {
    const normalizedDifficulty = String(difficulty ?? "moderate").trim().toLowerCase();
    const selectedDifficulty = quizDifficultyConfig[normalizedDifficulty]
      ? normalizedDifficulty
      : "moderate";
    const difficultyConfig = quizDifficultyConfig[selectedDifficulty];
    const safeQuestionCount = Math.max(1, Math.min(15, Number(questionCount) || 10));
    const textChunks = chunkText(text, 700).slice(0, 12);
    const summarizedChunks = [];

    for (let index = 0; index < textChunks.length; index += 1) {
      const summary = await generateQuizSourceFromChunk(
        textChunks[index],
        index,
        textChunks.length
      );

      if (summary) {
        summarizedChunks.push(`Chunk ${index + 1} summary:\n${summary}`);
      }
    }

    const sourceText = summarizedChunks.join("\n\n").slice(0, 18000);

    if (!sourceText.trim()) {
      throw new Error("No quiz source text could be prepared.");
    }

    const content = await chatWithOllama({
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `You are a strict study quiz generator.
Return valid JSON only.
Create exactly ${safeQuestionCount} multiple-choice questions based only on the provided study material.
Do not use outside knowledge.
Do not invent facts that are not supported by the source text.
Each question must have 4 options, one correct answer index from 0 to 3, and a short explanation.
Difficulty: ${difficultyConfig.label}.
Difficulty guidance: ${difficultyConfig.guidance}
Choose the most important topics from the source material yourself, but keep every question grounded in the provided text.
Return JSON in this shape:
{
  "title": "string",
  "description": "string",
  "questions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": 0,
      "explanation": "string"
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Generate a ${safeQuestionCount}-question ${difficultyConfig.label} quiz from this study material only:\n\n${sourceText}`,
        },
      ],
      format: "json",
    });

    const parsedQuiz = parseJsonResponse(content);
    const normalizedQuiz = normalizeQuiz(parsedQuiz, safeQuestionCount);

    if (normalizedQuiz.questions.length !== safeQuestionCount) {
      throw new Error("Quiz generation returned an invalid number of questions.");
    }

    return {
      ...normalizedQuiz,
      difficulty: difficultyConfig.label,
      questionCount: safeQuestionCount,
    };
  } catch (error) {
    console.error("Ollama quiz error:", error);
    throw new Error("Quiz generation failed");
  }
};

export const generateLevelBasedResponse = async ({
  question,
  concepts = [],
  level,
}) => {
  try {
    const prompt = buildPrompt({ question, concepts, level });

    const answer = await chatWithOllama({
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: "Answer using only the requested format. Keep it concise and useful.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return {
      prompt,
      answer,
    };
  } catch (error) {
    console.error("Ollama adaptive response error:", error);
    throw new Error("Adaptive response generation failed");
  }
};

export const answerQuestionWithContext = async ({ question, chunks }) => {
  try {
    const context = chunks
      .map((chunk, index) => `Source ${index + 1}:\n${chunk.content}`)
      .join("\n\n")
      .slice(0, 12000);
    const hasContext = Boolean(context.trim());

    const answer = await chatWithOllama({
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: hasContext
            ? "You are a study assistant. Answer only from the provided context. If the answer is not in the context, say \"I don't know based on the provided documents.\""
            : "You are a concise study assistant. Answer the user's question directly in simple language.",
        },
        {
          role: "user",
          content: hasContext
            ? `CONTEXT:\n${context}\n\nQUESTION: ${String(question ?? "").trim()}`
            : `QUESTION: ${String(question ?? "").trim()}`,
        },
      ],
    });

    return answer || (hasContext
      ? "I don't know based on the provided documents."
      : "I could not generate an answer right now.");
  } catch (error) {
    console.error("Ollama chat error:", error);
    throw new Error("Chat answer generation failed");
  }
};

export const answerQuestionWithTutorContext = async ({
  question,
  chunks,
  profile,
  memory,
  recentTurns,
  planner,
  refinement,
  correctionNotes,
}) => {
  try {
    const prompt = buildTutorPrompt({
      question,
      chunks,
      profile,
      memory,
      recentTurns,
      planner,
      refinement,
      correctionNotes,
    });

    const answer = await chatWithOllama({
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a personalized tutoring assistant. Follow the planner and profile exactly. Keep answers structured and do not restart when the planner says follow-up.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return answer || "I don't know based on the provided documents.";
  } catch (error) {
    console.error("Ollama tutor chat error:", error);
    throw new Error("Tutor chat answer generation failed");
  }
};

export const analyzeTutorInput = async ({
  question,
  profile,
  memory,
  recentTurns,
  refinement,
}) => {
  try {
    const analysis = await completeStructuredJson({
      systemContent: `You analyze a tutoring conversation.
Return valid JSON only with this exact shape:
{
  "intent": "new_question" | "follow_up" | "clarification",
  "target_concept": "string",
  "confusion_detected": true,
  "confusion_topic": "string",
  "misconception_detected": true,
  "misconception_statement": "string",
  "follow_up_confidence": 0
}
Use the previous turn context to determine whether this is a semantic follow-up, not only a keyword match.`,
      userContent: `Student profile:
- level: ${profile.level}
- weak_areas: ${profile.weakAreas.join(", ")}
- known misconceptions: ${profile.misconceptions.join(", ") || "none"}

Tutor memory:
${JSON.stringify(memory, null, 2)}

Recent turns:
${recentTurns.map((turn) => `${turn.role}: ${turn.question || turn.answer}`).join("\n") || "none"}

Current question:
${question}

Refinement request:
${refinement ? JSON.stringify(refinement) : "none"}

Classify the message and extract the real confusion or misconception if present.`,
    });

    return {
      intent: ["new_question", "follow_up", "clarification"].includes(analysis?.intent)
        ? analysis.intent
        : "new_question",
      targetConcept: String(analysis?.target_concept ?? "").trim(),
      confusionDetected: Boolean(analysis?.confusion_detected),
      confusionTopic: String(analysis?.confusion_topic ?? "").trim(),
      misconceptionDetected: Boolean(analysis?.misconception_detected),
      misconceptionStatement: String(analysis?.misconception_statement ?? "").trim(),
      followUpConfidence: Number(analysis?.follow_up_confidence ?? 0),
    };
  } catch (error) {
    const normalizedQuestion = String(question ?? "").trim().toLowerCase();
    const patternTopicMatch = normalizedQuestion.match(
      /(stack memory|call stack|stack frame|function calls|memory usage|recursion|iteration|performance)/i
    );
    const confusionDetected = /(i didn't understand|i did not understand|still confused|explain again|what do you mean)/i
      .test(normalizedQuestion);
    const misconceptionDetected = /(faster than iteration|always faster|recursion is faster)/i
      .test(normalizedQuestion);

    return {
      intent: confusionDetected || recentTurns.length ? "follow_up" : "new_question",
      targetConcept: patternTopicMatch?.[1] ? String(patternTopicMatch[1]).toLowerCase() : "",
      confusionDetected,
      confusionTopic: confusionDetected && patternTopicMatch?.[1]
        ? String(patternTopicMatch[1]).toLowerCase()
        : "",
      misconceptionDetected,
      misconceptionStatement: misconceptionDetected
        ? "recursion is faster than iteration"
        : "",
      followUpConfidence: confusionDetected ? 0.55 : 0.2,
      lowConfidence: true,
    };
  }
};

export const summarizeTutorResponse = async ({
  question,
  answer,
  inputAnalysis,
}) => {
  try {
    const summary = await completeStructuredJson({
      systemContent: `You summarize what a tutor response ACTUALLY did.
Return valid JSON only with this exact shape:
{
  "main_topic": "string",
  "concepts_explained": ["string"],
  "misconception_addressed": "string",
  "remaining_gaps": ["string"]
}
Do not infer concepts that are not truly present in the answer.`,
      userContent: `Student question:
${question}

Input analysis:
${JSON.stringify(inputAnalysis, null, 2)}

Tutor answer:
${answer}`,
    });

    return {
      mainTopic: String(summary?.main_topic ?? "").trim(),
      conceptsExplained: Array.isArray(summary?.concepts_explained)
        ? summary.concepts_explained.map((item) => String(item ?? "").trim()).filter(Boolean)
        : [],
      misconceptionAddressed: String(summary?.misconception_addressed ?? "").trim(),
      remainingGaps: Array.isArray(summary?.remaining_gaps)
        ? summary.remaining_gaps.map((item) => String(item ?? "").trim()).filter(Boolean)
        : [],
      lowConfidence: false,
    };
  } catch (error) {
    return {
      mainTopic: "",
      conceptsExplained: [],
      misconceptionAddressed: "",
      remainingGaps: [],
      lowConfidence: true,
    };
  }
};

export const verifyTutorResponse = async ({
  question,
  answer,
  planner,
  inputAnalysis,
}) => {
  const normalizedAnswer = String(answer ?? "").trim().toLowerCase();
  const normalizedTargetConcept = String(
    planner?.exactConceptToTeach || inputAnalysis?.confusionTopic || inputAnalysis?.targetConcept || ""
  ).trim().toLowerCase();
  const requiredSections = planner?.shouldZoomIn
    ? ["quick bridge", "focus concept", "why it matters", "mini check"]
    : ["intuition", "how it works", "deep dive", "common mistake", "final takeaway"];
  const deterministicChecks = {
    addressesTargetConcept: normalizedTargetConcept
      ? normalizedAnswer.includes(normalizedTargetConcept)
      : true,
    followsScaffoldStructure: requiredSections.every((section) => normalizedAnswer.includes(section)),
    followUpNarrowingOk: planner?.shouldZoomIn
      ? normalizedAnswer.includes("quick bridge") && normalizedAnswer.includes(normalizedTargetConcept)
      : true,
  };

  try {
    const verification = await completeStructuredJson({
      systemContent: `You verify tutor responses.
Return valid JSON only with this exact shape:
{
  "addresses_target_concept": true,
  "resolves_active_confusion": true,
  "follows_scaffold_structure": true,
  "uses_multihop_reasoning": true,
  "needs_regeneration": false,
  "correction_notes": ["string"]
}`,
      userContent: `Question:
${question}

Planner:
${JSON.stringify(planner, null, 2)}

Input analysis:
${JSON.stringify(inputAnalysis, null, 2)}

Tutor answer:
${answer}`,
    });

    const addressesTargetConcept = Boolean(verification?.addresses_target_concept) &&
      deterministicChecks.addressesTargetConcept;
    const followsScaffoldStructure = Boolean(verification?.follows_scaffold_structure) &&
      deterministicChecks.followsScaffoldStructure;
    const resolvesActiveConfusion = Boolean(verification?.resolves_active_confusion) &&
      (!planner?.shouldZoomIn || deterministicChecks.followUpNarrowingOk);
    const usesMultihopReasoning = Boolean(verification?.uses_multihop_reasoning);
    const needsRegeneration = Boolean(verification?.needs_regeneration) ||
      !addressesTargetConcept ||
      !followsScaffoldStructure ||
      !resolvesActiveConfusion ||
      (planner?.shouldZoomIn && !deterministicChecks.followUpNarrowingOk);

    const correctionNotes = Array.isArray(verification?.correction_notes)
      ? verification.correction_notes.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [];

    if (!deterministicChecks.addressesTargetConcept) {
      correctionNotes.push(`Explicitly address the target concept: ${normalizedTargetConcept}.`);
    }

    if (!deterministicChecks.followsScaffoldStructure) {
      correctionNotes.push(
        planner?.shouldZoomIn
          ? "Use the required follow-up sections: Quick bridge, Focus concept, Why it matters, Mini check."
          : "Use the required scaffold sections: Intuition, How it works, Deep dive, Common mistake, Final takeaway."
      );
    }

    if (planner?.shouldZoomIn && !deterministicChecks.followUpNarrowingOk) {
      correctionNotes.push("Do not restart the full lesson. Narrow the answer to the active confusion topic.");
    }

    return {
      addressesTargetConcept,
      resolvesActiveConfusion,
      followsScaffoldStructure,
      usesMultihopReasoning,
      needsRegeneration,
      correctionNotes,
      lowConfidence: false,
    };
  } catch (error) {
    const correctionNotes = [];

    if (!deterministicChecks.addressesTargetConcept) {
      correctionNotes.push(`Explicitly address the target concept: ${normalizedTargetConcept}.`);
    }

    if (!deterministicChecks.followsScaffoldStructure) {
      correctionNotes.push(
        planner?.shouldZoomIn
          ? "Use the required follow-up sections: Quick bridge, Focus concept, Why it matters, Mini check."
          : "Use the required scaffold sections: Intuition, How it works, Deep dive, Common mistake, Final takeaway."
      );
    }

    if (planner?.shouldZoomIn && !deterministicChecks.followUpNarrowingOk) {
      correctionNotes.push("Do not restart the full lesson. Narrow the answer to the active confusion topic.");
    }

    const structurallyUsable = deterministicChecks.addressesTargetConcept &&
      deterministicChecks.followsScaffoldStructure &&
      (!planner?.shouldZoomIn || deterministicChecks.followUpNarrowingOk);

    return {
      addressesTargetConcept: deterministicChecks.addressesTargetConcept,
      resolvesActiveConfusion: !planner?.shouldZoomIn || deterministicChecks.followUpNarrowingOk,
      followsScaffoldStructure: deterministicChecks.followsScaffoldStructure,
      usesMultihopReasoning: !planner?.shouldZoomIn || normalizedAnswer.includes("because"),
      needsRegeneration: !structurallyUsable,
      correctionNotes: correctionNotes.length
        ? correctionNotes
        : ["Verification model failed, but the response structure looks usable."],
      lowConfidence: true,
    };
  }
};

const refinePromptTemplates = {
  simplify: ({ context, answer }) => `You are a study assistant. Simplify the following explanation further so a beginner can understand it.

Rules:
- Use very simple language
- Short sentences
- Avoid jargon
- Use bullet points if needed
- Answer ONLY using the provided context
- If context is insufficient, say "Not enough information in the document"

CONTEXT:
${context}

ORIGINAL ANSWER:
${answer}

SIMPLIFIED VERSION:`,
  analogy: ({ context, answer }) => `You are a study assistant. Explain the concept using a real-world analogy.

Rules:
- Use relatable real-life examples
- Keep it intuitive
- Do not lose core meaning
- Answer ONLY using the provided context
- If context is insufficient, say "Not enough information in the document"

CONTEXT:
${context}

ORIGINAL ANSWER:
${answer}

ANALOGY EXPLANATION:`,
  deeper: ({ context, answer }) => `You are a study assistant. Expand the explanation in more depth.

Rules:
- Add more details and reasoning
- Explain underlying concepts
- Keep it structured
- Answer ONLY using the provided context
- If context is insufficient, say "Not enough information in the document"

CONTEXT:
${context}

ORIGINAL ANSWER:
${answer}

DETAILED EXPLANATION:`,
};

export const refineAnswerWithContext = async ({ type, answer, chunks }) => {
  try {
    const normalizedType = String(type ?? "").trim().toLowerCase();
    const promptBuilder = refinePromptTemplates[normalizedType];

    if (!promptBuilder) {
      throw new Error("Invalid refine type");
    }

    const context = chunks
      .map((chunk, index) => `Source ${index + 1}:\n${chunk.content}`)
      .join("\n\n")
      .slice(0, 12000);
    const hasContext = Boolean(context.trim());

    const refinedAnswer = await chatWithOllama({
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: hasContext
            ? "Transform the original answer using only the provided context. If context is not enough, say \"Not enough information in the document\"."
            : "Transform the original answer in the requested style while keeping the meaning accurate and clear.",
        },
        {
          role: "user",
          content: promptBuilder({
            context,
            answer: String(answer ?? "").trim(),
          }),
        },
      ],
    });

    return refinedAnswer || (hasContext
      ? "Not enough information in the document"
      : "I could not refine that answer right now.");
  } catch (error) {
    console.error("Ollama refine error:", error);
    throw new Error("Follow-up refinement failed");
  }
};
