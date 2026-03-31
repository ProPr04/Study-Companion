import pool from "../db/index.js";

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

let tutorTablesReady = false;

const sanitizeString = (value, fallback = "") => String(value ?? fallback).trim();

const sanitizeStringArray = (value, fallback = []) => {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return [...new Set(value.map((item) => sanitizeString(item)).filter(Boolean))];
};

const arraysOverlap = (left = [], right = []) => {
  const normalizedRight = sanitizeStringArray(right, []).map((item) => item.toLowerCase());
  return sanitizeStringArray(left, []).some((item) => normalizedRight.includes(item.toLowerCase()));
};

const isConceptRelevantToTopic = (concept, topic) => {
  const normalizedConcept = sanitizeString(concept).toLowerCase();
  const normalizedTopic = sanitizeString(topic).toLowerCase();

  if (!normalizedConcept || !normalizedTopic) {
    return false;
  }

  return normalizedConcept.includes(normalizedTopic) || normalizedTopic.includes(normalizedConcept);
};

const normalizeLevel = (level) => {
  const normalizedLevel = sanitizeString(level, DEFAULT_PROFILE.level).toLowerCase();
  return ["beginner", "intermediate", "advanced"].includes(normalizedLevel)
    ? normalizedLevel
    : DEFAULT_PROFILE.level;
};

const parseJsonColumn = (value, fallback) => {
  if (Array.isArray(value) || (value && typeof value === "object")) {
    return value;
  }

  if (typeof value !== "string") {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const ensureTutorContextTables = async () => {
  if (tutorTablesReady) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_profiles (
      user_id INTEGER PRIMARY KEY,
      level TEXT NOT NULL DEFAULT 'beginner',
      subject TEXT NOT NULL DEFAULT 'Data Structures and Algorithms',
      weak_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
      misconceptions JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tutor_memory (
      user_id INTEGER PRIMARY KEY,
      memory_state JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_turns (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      question TEXT,
      answer TEXT,
      input_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
      planner JSONB NOT NULL DEFAULT '{}'::jsonb,
      response_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE tutor_memory
    ADD COLUMN IF NOT EXISTS memory_state JSONB NOT NULL DEFAULT '{}'::jsonb
  `);

  await pool.query(`
    ALTER TABLE chat_turns
    ADD COLUMN IF NOT EXISTS input_analysis JSONB NOT NULL DEFAULT '{}'::jsonb
  `);

  tutorTablesReady = true;
};

const mapProfileRow = (row) => ({
  level: normalizeLevel(row?.level),
  subject: sanitizeString(row?.subject, DEFAULT_PROFILE.subject) || DEFAULT_PROFILE.subject,
  weakAreas: sanitizeStringArray(
    parseJsonColumn(row?.weak_areas, DEFAULT_PROFILE.weakAreas),
    DEFAULT_PROFILE.weakAreas
  ),
  misconceptions: sanitizeStringArray(
    parseJsonColumn(row?.misconceptions, DEFAULT_PROFILE.misconceptions),
    DEFAULT_PROFILE.misconceptions
  ),
});

const normalizeMemory = (memoryState = {}) => ({
  lastTopic: sanitizeString(memoryState?.lastTopic),
  explainedConcepts: sanitizeStringArray(memoryState?.explainedConcepts, []),
  unresolvedConcepts: sanitizeStringArray(memoryState?.unresolvedConcepts, []),
  activeConfusion: sanitizeString(memoryState?.activeConfusion),
  detectedMisconceptions: sanitizeStringArray(memoryState?.detectedMisconceptions, []),
  previousResponseSummary: {
    mainTopic: sanitizeString(memoryState?.previousResponseSummary?.mainTopic),
    conceptsExplained: sanitizeStringArray(memoryState?.previousResponseSummary?.conceptsExplained, []),
    misconceptionAddressed: sanitizeString(
      memoryState?.previousResponseSummary?.misconceptionAddressed
    ),
    remainingGaps: sanitizeStringArray(memoryState?.previousResponseSummary?.remainingGaps, []),
  },
});

export const getStudentProfile = async (userId) => {
  await ensureTutorContextTables();

  const result = await pool.query(
    `INSERT INTO student_profiles (user_id, level, subject, weak_areas, misconceptions)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING *`,
    [
      userId,
      DEFAULT_PROFILE.level,
      DEFAULT_PROFILE.subject,
      JSON.stringify(DEFAULT_PROFILE.weakAreas),
      JSON.stringify(DEFAULT_PROFILE.misconceptions),
    ]
  );

  if (result.rows[0]) {
    return mapProfileRow(result.rows[0]);
  }

  const existing = await pool.query("SELECT * FROM student_profiles WHERE user_id = $1", [userId]);
  return mapProfileRow(existing.rows[0]);
};

export const updateStudentProfile = async (userId, payload = {}) => {
  await ensureTutorContextTables();

  const currentProfile = await getStudentProfile(userId);
  const nextProfile = {
    level: normalizeLevel(payload.level ?? currentProfile.level),
    subject: sanitizeString(payload.subject, currentProfile.subject) || DEFAULT_PROFILE.subject,
    weakAreas: sanitizeStringArray(payload.weakAreas, currentProfile.weakAreas),
    misconceptions: sanitizeStringArray(payload.misconceptions, currentProfile.misconceptions),
  };

  const result = await pool.query(
    `UPDATE student_profiles
     SET level = $2,
         subject = $3,
         weak_areas = $4::jsonb,
         misconceptions = $5::jsonb,
         updated_at = NOW()
     WHERE user_id = $1
     RETURNING *`,
    [
      userId,
      nextProfile.level,
      nextProfile.subject,
      JSON.stringify(nextProfile.weakAreas),
      JSON.stringify(nextProfile.misconceptions),
    ]
  );

  return mapProfileRow(result.rows[0]);
};

const limitText = (value, maxLength = 240) => {
  const normalized = sanitizeString(value);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
};

const summarizeList = (values = [], limit = 3, fallback = "none") => {
  const normalized = sanitizeStringArray(values, []);

  if (!normalized.length) {
    return fallback;
  }

  return normalized.slice(0, limit).join(", ");
};

const buildCompactRecentTurns = (recentTurns = [], limit = 4) => {
  const turns = recentTurns.slice(-limit).map((turn) => {
    const content = turn.role === "assistant" ? turn.answer : turn.question;
    return `${turn.role}: ${limitText(content, 160) || "none"}`;
  });

  return turns.length ? turns.join("\n") : "none";
};

const buildCompactContext = (chunks = [], limit = 3, maxChunkLength = 900) => {
  const compact = chunks
    .slice(0, limit)
    .map((chunk, index) => `S${index + 1} (${sanitizeString(chunk.file_name || chunk.fileName || "document")}): ${limitText(chunk.content, maxChunkLength)}`)
    .join("\n");

  return compact || "No document context provided for this turn.";
};

export const getTutorMemory = async (userId) => {
  await ensureTutorContextTables();

  const result = await pool.query(
    `INSERT INTO tutor_memory (user_id, memory_state)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING *`,
    [userId, JSON.stringify(DEFAULT_MEMORY)]
  );

  if (result.rows[0]) {
    return normalizeMemory(parseJsonColumn(result.rows[0].memory_state, DEFAULT_MEMORY));
  }

  const existing = await pool.query("SELECT * FROM tutor_memory WHERE user_id = $1", [userId]);
  return normalizeMemory(parseJsonColumn(existing.rows[0]?.memory_state, DEFAULT_MEMORY));
};

export const getRecentChatTurns = async (userId, limit = 6) => {
  await ensureTutorContextTables();

  const result = await pool.query(
    `SELECT *
     FROM chat_turns
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows.reverse().map((row) => ({
    id: row.id,
    role: row.role,
    question: sanitizeString(row.question),
    answer: sanitizeString(row.answer),
    inputAnalysis: parseJsonColumn(row.input_analysis, {}),
    planner: parseJsonColumn(row.planner, {}),
    responseSummary: parseJsonColumn(row.response_summary, {}),
    createdAt: row.created_at,
  }));
};

export const buildTutorPlan = ({
  profile,
  memory,
  inputAnalysis,
  refinement,
}) => {
  const unresolvedConcepts = sanitizeStringArray(memory.unresolvedConcepts, []);
  const dynamicMisconceptions = sanitizeStringArray(memory.detectedMisconceptions, []);
  const previousConcepts = sanitizeStringArray(memory.previousResponseSummary?.conceptsExplained, []);
  const sameTopicFollowUp = inputAnalysis.intent === "follow_up" &&
    inputAnalysis.followUpConfidence >= 0.65 &&
    (
      isConceptRelevantToTopic(inputAnalysis.targetConcept, memory.lastTopic) ||
      isConceptRelevantToTopic(inputAnalysis.confusionTopic, memory.lastTopic) ||
      arraysOverlap(inputAnalysis.questionAspects, previousConcepts)
    );
  const targetConcept =
    sanitizeString(inputAnalysis.confusionTopic) ||
    sanitizeString(inputAnalysis.targetConcept) ||
    (sameTopicFollowUp ? unresolvedConcepts[0] : "") ||
    (sameTopicFollowUp ? sanitizeString(memory.lastTopic) : "");
  const relevantProfileMisconception = sanitizeStringArray(profile.misconceptions, []).find((item) =>
    isConceptRelevantToTopic(item, targetConcept)
  );
  const relevantDynamicMisconception = dynamicMisconceptions.find((item) =>
    isConceptRelevantToTopic(item, targetConcept)
  );
  const misconceptionToCorrect = inputAnalysis.misconceptionDetected
    ? inputAnalysis.misconceptionStatement
    : relevantDynamicMisconception || relevantProfileMisconception || "";
  const zoomMode = !inputAnalysis.needsClarification &&
    !inputAnalysis.selfResolved &&
    (
      inputAnalysis.confusionDetected ||
      sameTopicFollowUp ||
      Boolean(refinement)
    );
  const weakAreaFocus = profile.weakAreas.filter((item) =>
    targetConcept.toLowerCase().includes(item.toLowerCase())
  );

  return {
    mode: inputAnalysis.needsClarification || inputAnalysis.selfResolved
      ? "clarify"
      : zoomMode
        ? "zoom_in"
        : "full_explanation",
    exactConceptToTeach: targetConcept,
    explanationDepth: zoomMode ? `${profile.level}_focused` : `${profile.level}_full`,
    shouldZoomIn: zoomMode,
    shouldClarify: Boolean(inputAnalysis.needsClarification),
    shouldAcknowledgeResolution: Boolean(inputAnalysis.selfResolved),
    shouldCorrectMisconception: Boolean(misconceptionToCorrect),
    misconceptionToCorrect,
    unresolvedConcepts: sameTopicFollowUp ? unresolvedConcepts : [],
    activeConfusion: inputAnalysis.confusionDetected
      ? inputAnalysis.confusionTopic
      : sameTopicFollowUp
        ? memory.activeConfusion
        : "",
    weakAreaFocus: weakAreaFocus,
    refinement,
  };
};

export const buildTutorPrompt = ({
  question,
  chunks,
  profile,
  memory,
  recentTurns,
  planner,
  refinement,
  correctionNotes = [],
}) => {
  const context = buildCompactContext(chunks);
  const hasContext = Boolean(context.trim());
  const previousSummary = memory.previousResponseSummary;
  const modeLabel = planner.shouldClarify
    ? "clarify"
    : planner.shouldAcknowledgeResolution
      ? "confirm"
      : planner.shouldZoomIn
        ? "zoom_in"
        : "full";
  const formatLabel = planner.shouldClarify
    ? "Clarify | Why I am asking | Next reply"
    : planner.shouldAcknowledgeResolution
      ? "Quick bridge | Confirmed | Next step"
      : planner.shouldZoomIn
        ? "Quick bridge | Focus concept | Why it matters | Mini check"
        : "Intuition | How it works | Deep dive | Common mistake | Final takeaway";

  return `You are a concise, context-aware AI tutor.

Goal:
- Answer the student's current question directly.
- Continue the conversation without restarting unless clarification is required.

Student:
- level: ${profile.level}
- subject: ${limitText(profile.subject, 80) || "none"}
- weak_areas: ${summarizeList(profile.weakAreas)}
- misconceptions: ${summarizeList(profile.misconceptions)}
- dynamic_misconceptions: ${summarizeList(memory.detectedMisconceptions)}

Memory:
- last_topic: ${limitText(memory.lastTopic, 80) || "none"}
- explained: ${summarizeList(memory.explainedConcepts)}
- unresolved: ${summarizeList(memory.unresolvedConcepts)}
- active_confusion: ${limitText(memory.activeConfusion, 80) || "none"}
- previous_summary: main=${limitText(previousSummary.mainTopic, 80) || "none"}; concepts=${summarizeList(previousSummary.conceptsExplained)}; remaining=${summarizeList(previousSummary.remainingGaps)}

Planner:
- mode: ${modeLabel}
- target: ${limitText(planner.exactConceptToTeach, 100) || "none"}
- depth: ${planner.explanationDepth}
- active_confusion: ${limitText(planner.activeConfusion, 100) || "none"}
- misconception_to_correct: ${limitText(planner.misconceptionToCorrect, 120) || "none"}
- emphasis: ${summarizeList(planner.weakAreaFocus)}

Recent turns:
${buildCompactRecentTurns(recentTurns)}

Refinement:
- type: ${refinement?.type || "none"}
- original_question: ${limitText(refinement?.originalQuestion, 120) || "none"}
- previous_answer: ${limitText(refinement?.previousAnswer, 220) || "none"}

Verifier notes:
- ${correctionNotes.length ? correctionNotes.slice(0, 3).map((note) => limitText(note, 120)).join(" | ") : "none"}

Rules:
- If ambiguous, ask a short clarifying question.
- If the student already resolved it, acknowledge and offer the next step.
- If active confusion exists, focus on that first.
- Correct misconceptions explicitly when present.
- Use beginner-friendly language for beginners.
- Use the exact section headings for the selected format.
- ${hasContext ? "Use the provided context for factual grounding when relevant." : "No document context is available; answer carefully from general subject knowledge."}
- Do not add specialized variants not asked for.

Format:
${formatLabel}

Context:
${context}

Question:
${sanitizeString(question)}`;
};

const toNaturalList = (items = [], fallback = "the earlier explanation") => {
  const normalized = sanitizeStringArray(items, []).slice(0, 3);

  if (!normalized.length) {
    return fallback;
  }

  if (normalized.length === 1) {
    return normalized[0];
  }

  if (normalized.length === 2) {
    return `${normalized[0]} or ${normalized[1]}`;
  }

  return `${normalized.slice(0, -1).join(", ")}, or ${normalized[normalized.length - 1]}`;
};

export const buildTutorFallbackResponse = ({
  question,
  inputAnalysis,
  planner,
  memory,
}) => {
  if (inputAnalysis.needsClarification) {
    const likelyTopics = /\bstack\b/i.test(question)
      ? "call stack, the stack data structure, or a web tech stack"
      : toNaturalList(memory.previousResponseSummary?.conceptsExplained, memory.lastTopic || "the earlier explanation");

    return [
      "1. Clarify",
      `I want to make sure I answer the right thing before I guess.`,
      "",
      "2. Why I am asking",
      inputAnalysis.clarificationReason === "unclear_reference"
        ? `The phrase you used could refer to ${likelyTopics}.`
        : `Your question could reasonably mean ${likelyTopics}.`,
      "",
      "3. Next reply",
      "Reply with the exact concept you want, and I will focus only on that.",
    ].join("\n");
  }

  if (inputAnalysis.selfResolved) {
    const confirmedConcept = planner.exactConceptToTeach || memory.lastTopic || "that concept";

    return [
      "1. Quick bridge",
      "Yes, that sounds right.",
      "",
      "2. Confirmed",
      `You have the key idea: ${confirmedConcept}.`,
      "",
      "3. Next step",
      "If you want, I can either go one level deeper or switch topics cleanly.",
    ].join("\n");
  }

  if (inputAnalysis.misconceptionDetected) {
    return [
      "1. Intuition",
      "Not necessarily. Recursion can be clearer, but it is not automatically faster than iteration.",
      "",
      "2. How it works",
      "Each recursive call adds a new stack frame, so recursion can use more memory and add overhead.",
      "",
      "3. Deep dive",
      "Iteration often wins on raw efficiency because it usually avoids that extra call-stack growth. Recursion can still be a good choice when the problem structure is naturally recursive.",
      "",
      "4. Common mistake",
      "The mistake is assuming elegance means speed. Readability and runtime cost are different questions.",
      "",
      "5. Final takeaway",
      "Treat recursion as a modeling tool, not a default performance optimization.",
    ].join("\n");
  }

  if (planner.shouldZoomIn && planner.exactConceptToTeach) {
    return [
      "1. Quick bridge",
      "You already understand the broader idea, so let’s isolate the missing piece.",
      "",
      "2. Focus concept",
      `${planner.exactConceptToTeach} is the part that connects this question to the earlier explanation.`,
      "",
      "3. Why it matters",
      "That missing piece is what makes the rest of the reasoning fit together instead of feeling memorized.",
      "",
      "4. Mini check",
      `If you want, reply with "${planner.exactConceptToTeach}" and I will explain just that part with one concrete example.`,
    ].join("\n");
  }

  return [
    "1. Intuition",
    "I can help with that, but I want to keep the answer aligned with your exact question.",
    "",
    "2. How it works",
    "If you restate the concept in one short phrase, I will answer it directly.",
    "",
    "3. Deep dive",
    "This avoids dragging in old context that may not be relevant anymore.",
    "",
    "4. Common mistake",
    "The main risk here is answering a nearby question instead of your real one.",
    "",
    "5. Final takeaway",
    "Send the exact concept you want next, and I will keep the answer narrow.",
  ].join("\n");
};

const mergeMisconceptions = (existing, additions, addressed) => {
  const merged = new Set(sanitizeStringArray(existing, []));

  sanitizeStringArray(additions, []).forEach((item) => merged.add(item));

  if (addressed) {
    merged.delete(sanitizeString(addressed));
  }

  return [...merged];
};

export const updateTutorMemoryFromTurn = ({
  memory,
  inputAnalysis,
  responseSummary,
  verification,
}) => {
  const sameTopicContinuation = inputAnalysis.intent === "follow_up" && inputAnalysis.followUpConfidence >= 0.65;
  const unresolved = new Set(
    sameTopicContinuation
      ? sanitizeStringArray(memory.unresolvedConcepts, [])
      : []
  );
  const explained = sanitizeStringArray(
    [
      ...(sameTopicContinuation ? memory.explainedConcepts : []),
      ...(verification?.addressesTargetConcept ? responseSummary.conceptsExplained : []),
    ],
    []
  );

  if (inputAnalysis.confusionDetected && inputAnalysis.confusionTopic) {
    unresolved.add(inputAnalysis.confusionTopic);
  }

  if (verification?.addressesTargetConcept) {
    sanitizeStringArray(responseSummary.conceptsExplained, []).forEach((concept) => {
      if (!sanitizeStringArray(responseSummary.remainingGaps, []).includes(concept)) {
        unresolved.delete(concept);
      }
    });
  }

  if (verification?.resolvesActiveConfusion && inputAnalysis.confusionTopic) {
    unresolved.delete(inputAnalysis.confusionTopic);
  } else if (inputAnalysis.confusionTopic) {
    unresolved.add(inputAnalysis.confusionTopic);
  }

  const allowedRemainingGaps = inputAnalysis.confusionDetected
    ? sanitizeStringArray(responseSummary.remainingGaps, [])
    : [];

  allowedRemainingGaps.forEach((gap) => unresolved.add(gap));

  const verifiedMainTopic = verification?.addressesTargetConcept
    ? sanitizeString(responseSummary.mainTopic || inputAnalysis.targetConcept || memory.lastTopic)
    : sanitizeString(memory.lastTopic);

  const activeConfusion = inputAnalysis.confusionDetected
    ? verification?.resolvesActiveConfusion
      ? allowedRemainingGaps[0] || ""
      : sanitizeString(inputAnalysis.confusionTopic || memory.activeConfusion)
    : "";

  const nextMemory = {
    lastTopic: verifiedMainTopic,
    explainedConcepts: explained,
    unresolvedConcepts: [...unresolved],
    activeConfusion,
    detectedMisconceptions: mergeMisconceptions(
      memory.detectedMisconceptions,
      inputAnalysis.misconceptionDetected ? [inputAnalysis.misconceptionStatement] : [],
      verification?.addressesTargetConcept ? responseSummary.misconceptionAddressed : ""
    ),
    previousResponseSummary: {
      mainTopic: verification?.addressesTargetConcept ? sanitizeString(responseSummary.mainTopic) : "",
      conceptsExplained: verification?.addressesTargetConcept
        ? sanitizeStringArray(responseSummary.conceptsExplained, [])
        : [],
      misconceptionAddressed: verification?.addressesTargetConcept
        ? sanitizeString(responseSummary.misconceptionAddressed)
        : "",
      remainingGaps: allowedRemainingGaps,
    },
  };

  return normalizeMemory(nextMemory);
};

export const saveTutorTurn = async ({
  userId,
  question,
  answer,
  inputAnalysis,
  planner,
  responseSummary,
  nextMemory,
}) => {
  await ensureTutorContextTables();

  await pool.query(
    `INSERT INTO chat_turns (user_id, role, question, input_analysis, planner, response_summary)
     VALUES ($1, 'user', $2, $3::jsonb, $4::jsonb, '{}'::jsonb)`,
    [
      userId,
      sanitizeString(question),
      JSON.stringify(inputAnalysis),
      JSON.stringify(planner),
    ]
  );

  await pool.query(
    `INSERT INTO chat_turns (user_id, role, question, answer, input_analysis, planner, response_summary)
     VALUES ($1, 'assistant', $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)`,
    [
      userId,
      sanitizeString(question),
      sanitizeString(answer),
      JSON.stringify(inputAnalysis),
      JSON.stringify(planner),
      JSON.stringify(responseSummary),
    ]
  );

  await pool.query(
    `INSERT INTO tutor_memory (user_id, memory_state, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET
       memory_state = EXCLUDED.memory_state,
       updated_at = NOW()`,
    [userId, JSON.stringify(nextMemory)]
  );

  return nextMemory;
};
