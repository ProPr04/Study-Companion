const levelConfig = {
  beginner: {
    tone: "simple, supportive",
    steps: "short answer, key idea, one example",
    wordLimit: 120,
    extraInstructions: "Use easy words. Avoid jargon unless explained.",
  },
  intermediate: {
    tone: "clear, direct",
    steps: "concise answer, concept link, practical example",
    wordLimit: 90,
    extraInstructions: "Focus on understanding and connections.",
  },
  advanced: {
    tone: "precise, analytical",
    steps: "direct answer, deep concept link, edge case or nuance",
    wordLimit: 70,
    extraInstructions: "Be compact. Emphasize reasoning and precision.",
  },
};

const DEFAULT_LEVEL = "beginner";

const normalizeConcepts = (concepts) => {
  if (Array.isArray(concepts)) {
    return concepts
      .map((concept) => String(concept ?? "").trim())
      .filter(Boolean)
      .join(", ");
  }

  return String(concepts ?? "").trim();
};

export function buildPrompt({ question = "", concepts = [], level = DEFAULT_LEVEL } = {}) {
  const normalizedLevel = String(level || DEFAULT_LEVEL).trim().toLowerCase();
  const selectedLevel = levelConfig[normalizedLevel] ? normalizedLevel : DEFAULT_LEVEL;
  const config = levelConfig[selectedLevel];
  const normalizedQuestion = String(question ?? "").trim();
  const normalizedConcepts = normalizeConcepts(concepts);

  return [
    `Level: ${selectedLevel}`,
    `Tone: ${config.tone}`,
    `Format: ${config.steps}`,
    "",
    `Q: ${normalizedQuestion}`,
    `Concepts: ${normalizedConcepts}`,
    "",
    `Instructions: ${config.extraInstructions}`,
    `Limit: ${config.wordLimit} words`,
  ].join("\n");
}

export default buildPrompt;
