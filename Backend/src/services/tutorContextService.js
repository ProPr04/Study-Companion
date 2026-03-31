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
  const targetConcept =
    sanitizeString(inputAnalysis.confusionTopic) ||
    sanitizeString(inputAnalysis.targetConcept) ||
    unresolvedConcepts[0] ||
    sanitizeString(memory.lastTopic);
  const misconceptionToCorrect = inputAnalysis.misconceptionDetected
    ? inputAnalysis.misconceptionStatement
    : dynamicMisconceptions[0] || profile.misconceptions[0] || "";
  const zoomMode = inputAnalysis.confusionDetected || inputAnalysis.intent !== "new_question";
  const weakAreaFocus = profile.weakAreas.filter((item) =>
    targetConcept.toLowerCase().includes(item.toLowerCase())
  );

  return {
    mode: zoomMode ? "zoom_in" : "full_explanation",
    exactConceptToTeach: targetConcept,
    explanationDepth: zoomMode ? `${profile.level}_focused` : `${profile.level}_full`,
    shouldZoomIn: zoomMode,
    shouldCorrectMisconception: Boolean(misconceptionToCorrect),
    misconceptionToCorrect,
    unresolvedConcepts,
    activeConfusion: inputAnalysis.confusionDetected
      ? inputAnalysis.confusionTopic
      : memory.activeConfusion,
    weakAreaFocus: weakAreaFocus.length ? weakAreaFocus : profile.weakAreas,
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
  const context = chunks
    .map((chunk, index) => `Source ${index + 1}:\n${chunk.content}`)
    .join("\n\n")
    .slice(0, 12000);
  const hasContext = Boolean(context.trim());
  const previousSummary = memory.previousResponseSummary;

  return `You are a context-aware AI tutor.

Student profile:
- Level: ${profile.level}
- Subject: ${profile.subject}
- Weak areas: ${profile.weakAreas.join(", ") || "none"}
- Known misconceptions: ${profile.misconceptions.join(", ") || "none"}
- Dynamically detected misconceptions: ${memory.detectedMisconceptions.join(", ") || "none"}

Tutor memory:
- Last topic: ${memory.lastTopic || "none"}
- Last explained concepts: ${memory.explainedConcepts.join(", ") || "none"}
- Unresolved concepts: ${memory.unresolvedConcepts.join(", ") || "none"}
- Active confusion: ${memory.activeConfusion || "none"}

Previous response summary:
- Main topic: ${previousSummary.mainTopic || "none"}
- Concepts explained: ${previousSummary.conceptsExplained.join(", ") || "none"}
- Misconception addressed: ${previousSummary.misconceptionAddressed || "none"}
- Remaining gaps: ${previousSummary.remainingGaps.join(", ") || "none"}

Recent turns:
${recentTurns.map((turn) => `${turn.role}: ${turn.question || turn.answer}`).join("\n") || "none"}

Current question:
${sanitizeString(question)}

Planner:
- Exact concept to teach: ${planner.exactConceptToTeach || "none"}
- Explanation depth: ${planner.explanationDepth}
- Zoom in: ${planner.shouldZoomIn ? "yes" : "no"}
- Active confusion to resolve: ${planner.activeConfusion || "none"}
- Misconception to correct: ${planner.misconceptionToCorrect || "none"}
- Weak-area emphasis: ${planner.weakAreaFocus.join(", ") || "none"}

Refinement request:
${refinement ? JSON.stringify(refinement) : "none"}

Previous answer to continue from:
${refinement?.previousAnswer || "none"}

Correction notes from verifier:
${correctionNotes.join(" | ") || "none"}

Mandatory instructions:
- Do NOT restart explanation. Continue from previous understanding.
- If active confusion exists, focus only on that concept first.
- If unresolved concepts exist, prioritize them before expanding further.
- If a misconception is present, explicitly correct it.
- Use beginner-friendly language when level is beginner.
- Use scaffolded teaching.
- Include multi-hop reasoning when the topic depends on linked concepts.
- ${hasContext
    ? "Use the provided document context for factual support whenever relevant."
    : "No document context is available, so answer using your own subject knowledge carefully."}

Formatting:
- If this is a zoomed-in follow-up, use:
  1. Quick bridge
  2. Focus concept
  3. Why it matters
  4. Mini check
- Otherwise use:
  1. Intuition
  2. How it works
  3. Deep dive
  4. Common mistake
  5. Final takeaway

CONTEXT:
${hasContext ? context : "No document context provided for this turn."}

QUESTION:
${sanitizeString(question)}`;
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
  const unresolved = new Set(sanitizeStringArray(memory.unresolvedConcepts, []));
  const explained = sanitizeStringArray(
    [
      ...memory.explainedConcepts,
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

  sanitizeStringArray(responseSummary.remainingGaps, []).forEach((gap) => unresolved.add(gap));

  const verifiedMainTopic = verification?.addressesTargetConcept
    ? sanitizeString(responseSummary.mainTopic || inputAnalysis.targetConcept || memory.lastTopic)
    : sanitizeString(memory.lastTopic);

  const activeConfusion = verification?.resolvesActiveConfusion
    ? sanitizeStringArray(responseSummary.remainingGaps, [])[0] || ""
    : sanitizeString(inputAnalysis.confusionTopic || memory.activeConfusion);

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
      remainingGaps: sanitizeStringArray(responseSummary.remainingGaps, []),
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
