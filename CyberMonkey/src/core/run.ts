import { scoreSelection } from "./controls.mjs";
import { PADS, distanceToRoute } from "./map.ts";
import { MATCH_BOARDS, matchPoints } from "./matching.ts";
import { selectPhaseQuestions } from "./questions.ts";
import type {
  Category,
  Scenario,
  Tower,
  Question,
} from "./types.ts";
export const CONFIG = {
  gameName: "CyberMonkey",
  businessName: "Northstar Energy",
  behaviourPoints: 3,
  shieldBonus: 5,
};
export const CATEGORIES: Category[] = ["Prevent", "Detect", "Respond"];
export const STARTER = ["P5", "P6", "P7", "D1", "R1", "R2", "R4"];
export type Stage =
  | "shop"
  | "story"
  | "match"
  | "deploy"
  | "battle"
  | "question"
  | "intermission"
  | "gameover";

// Explicit rankings avoid silently changing the board when source scores tie.
export function offersFor(data: Scenario, phase: number): string[] {
  const board = MATCH_BOARDS[phase];
  if (!board) throw Error("Unknown matching phase.");
  const ids = board.flat();
  if (ids.some((id, i) => !data.controls.some(
    (c) => c.id === id && c.category === CATEGORIES[Math.floor(i / 3)],
  ))) throw Error("The matching board does not match this control deck.");
  return ids;
}
export class Run {
  data: Scenario;
  stage: Stage = "shop";
  chosen: string[] = [];
  phase = 0;
  towers: Tower[] = [];
  claimed: string[] = [];
  health = 100;
  behaviour = 0;
  correctAnswers = 0;
  answers: { id: string; answer: string | null; correct: boolean }[] = [];
  survivalWave = 0;
  cleared = 0;
  lastWaveKills = 0;
  lastWaveLeaks = 0;
  questionIndex = 0;
  readonly phaseQuestions: Question[][];
  constructor(data: Scenario, questions: Question[], random = Math.random) {
    this.data = data;
    this.phaseQuestions = selectPhaseQuestions(questions, data.phases.map((phase) => phase.id), random);
  }
  get currentQuestion() {
    return this.phaseQuestions[this.phase][this.questionIndex];
  }
  get checkpointQuestions() {
    return this.phaseQuestions[this.phase];
  }
  get checkpointComplete() {
    return this.checkpointQuestions.every((q) => this.answers.some((answer) => answer.id === q.id));
  }
  nextQuestion() {
    if (this.stage !== "question" ||
      !this.answers.some((answer) => answer.id === this.currentQuestion.id) ||
      this.questionIndex >= this.checkpointQuestions.length - 1) return false;
    this.questionIndex++;
    return true;
  }
  get spent() {
    return this.data.controls
      .filter((c) => this.chosen.includes(c.id))
      .reduce((s, c) => s + c.cost, 0);
  }
  get controlScore() {
    return this.towers.reduce((sum, tower) => sum + tower.level, 0);
  }
  get phaseScore() {
    return this.claimed.reduce((sum, id) => sum + matchPoints(this.phase, id), 0);
  }
  get deck() {
    return this.chosen.filter((id) => !this.claimed.includes(id));
  }
  get offers() {
    return offersFor(this.data, this.phase);
  }
  get eligible() {
    return this.offers.filter((id) => this.chosen.includes(id));
  }
  get pending() {
    return this.towers.filter((t) => t.pad === null);
  }
  toggle(id: string) {
    if (this.stage !== "shop")
      throw Error("Your loadout is locked for this run.");
    const control = this.data.controls.find((c) => c.id === id);
    if (!control) throw Error("Unknown control.");
    if (this.chosen.includes(id))
      this.chosen = this.chosen.filter((c) => c !== id);
    else {
      if (this.spent + control.cost > this.data.budget)
        throw Error("This card exceeds your remaining budget.");
      this.chosen.push(id);
    }
  }
  lock() {
    if (this.stage !== "shop") return;
    // Retain purchase validation; gameplay rewards come only from placed matches.
    scoreSelection(this.data, this.chosen);
    this.stage = "story";
  }
  beginMatching() {
    if (this.stage !== "story") return;
    this.stage = "match";
  }
  claim(id: string, targetId: string) {
    if (
      this.stage !== "match" ||
      id !== targetId ||
      !this.eligible.includes(id) ||
      this.claimed.includes(id)
    )
      return false;
    const c = this.data.controls.find((c) => c.id === id)!;
    this.towers.push({
      uid: `${this.phase}-${id}`,
      controlId: id,
      category: c.category,
      level: matchPoints(this.phase, id),
      pad: null,
    });
    this.claimed.push(id);
    return true;
  }
  finishMatching() {
    if (this.stage !== "match") return;
    if (this.eligible.some((id) => !this.claimed.includes(id)))
      throw Error("Place every matching card from your deck first.");
    this.stage = "question";
  }
  place(uid: string, pad: number) {
    if (
      this.stage !== "deploy" ||
      !Number.isInteger(pad) ||
      !PADS[pad] ||
      this.towers.some((t) => t.pad === pad)
    )
      return false;
    const t = this.towers.find((t) => t.uid === uid && t.pad === null);
    if (!t) return false;
    t.pad = pad;
    return true;
  }
  autoPlace() {
    const free = PADS.map((p, i) => ({
      i,
      score: distanceToRoute(p) + Math.abs(p.x - 500) * 0.04,
    }))
      .filter((p) => !this.towers.some((t) => t.pad === p.i))
      .sort((a, b) => a.score - b.score);
    this.pending.forEach((t) => {
      const p = free.shift();
      if (p) this.place(t.uid, p.i);
    });
  }
  startBattle() {
    if (this.stage === "deploy") {
      if (this.pending.length)
        throw Error("Place all earned towers before starting the wave.");
    } else if (this.stage === "intermission") {
      if (this.survivalWave === 0)
        this.health = 100 + this.correctAnswers * CONFIG.shieldBonus;
      this.survivalWave++;
    } else return false;
    this.stage = "battle";
    return true;
  }
  finishBattle(health: number, kills: number, leaks: number) {
    if (this.stage !== "battle") return;
    this.health = health;
    this.lastWaveKills = kills;
    this.lastWaveLeaks = leaks;
    if (this.survivalWave > 0) {
      if (health <= 0) this.stage = "gameover";
      else {
        this.cleared = this.survivalWave;
        this.stage = "intermission";
      }
    } else if (this.phase < 3) {
      this.phase++;
      this.questionIndex = 0;
      this.claimed = [];
      this.stage = "story";
    } else this.stage = "intermission";
  }
  answer(answer: string | null) {
    const question = this.currentQuestion;
    if (
      this.stage !== "question" ||
      (answer !== null && !Object.hasOwn(question.options, answer)) ||
      this.answers.some((a) => a.id === question.id)
    )
      return false;
    const correct = answer === question.correct;
    this.answers.push({ id: question.id, answer, correct });
    if (correct) {
      this.behaviour += CONFIG.behaviourPoints;
      this.correctAnswers++;
      this.health = Math.min(100, this.health + 10);
    }
    return true;
  }
  finishQuestions() {
    if (this.stage !== "question" || !this.checkpointComplete) return false;
    this.stage = "deploy";
    return true;
  }
}
