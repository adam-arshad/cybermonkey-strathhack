import type { Question } from "./types.ts";

export const QUESTIONS_PER_PHASE = 5;

// Supplement the pack's phase-linked questions with general questions.
// Delivery: suspicious links. Discovery: information gathering and exposure.
// Command & control: account/physical access. Ransom: safe working under pressure.
const GENERAL_QUESTIONS: Record<string, string[]> = {
  phase_1: ["Q13", "Q14", "Q18", "Q19", "Q20"],
  phase_2: ["Q21", "Q24", "Q25", "Q33", "Q34", "Q36"],
  phase_3: ["Q05", "Q06", "Q07", "Q23", "Q26", "Q28"],
  phase_4: ["Q17", "Q27", "Q31", "Q35", "Q38", "Q39", "Q40"],
};

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Keep the Cyber team's phase relevance labels and original wording.
// Shuffle a copy, relabelling answers A–D and tracking the correct answer.
export function shuffleAnswers(question: Question, random = Math.random): Question {
  const entries = shuffle(Object.entries(question.options), random);
  return {
    ...question,
    options: Object.fromEntries(entries.map(([, text], i) => [String.fromCharCode(65 + i), text])),
    correct: String.fromCharCode(65 + entries.findIndex(([key]) => key === question.correct)),
  };
}

export function selectPhaseQuestions(
  bank: Question[],
  phaseIds: string[],
  random = Math.random,
): Question[][] {
  return phaseIds.map((phaseId) => {
    const linked = bank.filter((question) => question.phase_id === phaseId);
    const general = bank.filter((question) => question.phase_id === null &&
      GENERAL_QUESTIONS[phaseId]?.includes(question.id));
    const candidates = [...linked, ...general];
    if (new Set(candidates.map((q) => q.id)).size !== candidates.length ||
      !linked.length || candidates.length < QUESTIONS_PER_PHASE)
      throw Error(`Need ${QUESTIONS_PER_PHASE} unique relevant questions for ${phaseId}.`);
    // Include up to four directly linked questions, then sample the general pool.
    const linkedCount = Math.min(4, linked.length);
    const chosen = [
      ...shuffle(linked, random).slice(0, linkedCount),
      ...shuffle(general, random).slice(0, QUESTIONS_PER_PHASE - linkedCount),
    ];
    if (chosen.length !== QUESTIONS_PER_PHASE)
      throw Error(`Need ${QUESTIONS_PER_PHASE} unique relevant questions for ${phaseId}.`);
    return shuffle(chosen, random)
      .map((question) => shuffleAnswers(question, random));
  });
}
