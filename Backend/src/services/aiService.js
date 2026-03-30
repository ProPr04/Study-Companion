import Groq from "groq-sdk";
import "../config/env.js";
import { chunkText } from "../utils/textProcessor.js";
import { buildPrompt } from "../utils/buildPrompt.js";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

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
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant", // fast + free tier friendly
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

    return response.choices[0].message.content;

  } catch (error) {
    console.error("Groq AI error:", error);
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
  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
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

  return response.choices?.[0]?.message?.content?.trim() ?? "";
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

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
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
    });

    const content = response.choices?.[0]?.message?.content ?? "";
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
    console.error("Groq quiz error:", error);
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

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
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
      answer: response.choices?.[0]?.message?.content?.trim() ?? "",
    };
  } catch (error) {
    console.error("Groq adaptive response error:", error);
    throw new Error("Adaptive response generation failed");
  }
};
