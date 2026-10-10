import { scoreSelection } from "./controls.mjs";
import { PADS, distanceToRoute } from "./map.ts";
import type {
  Category,
  Scenario,
  ScoreResult,
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
  | "match"
  | "deploy"
  | "battle"
  | "question"
  | "intermission"
  | "gameover";

// Fixed phase-specific reveals make different loadouts comparable. Ties retain pack order.
export function offersFor(data: Scenario, phase: number): string[] {
  return CATEGORIES.flatMap((category) =>
    data.controls
      .filter((c) => c.category === category)
      .sort(
        (a, b) =>
          data.phases[phase].scores[b.id] - data.phases[phase].scores[a.id],
      )
      .slice(0, 3)
      .map((c) => c.id),
  );
}
export class Run {
  data: Scenario;
  stage: Stage = "shop";
  chosen: string[] = [];
  phase = 0;
  result: ScoreResult | null = null;
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
  constructor(data: Scenario) {
    this.data = data;
  }
  get spent() {
    return this.data.controls
      .filter((c) => this.chosen.includes(c.id))
      .reduce((s, c) => s + c.cost, 0);
  }
  get controlScore() {
    return (
      this.result?.phases
        .slice(0, this.phase + 1)
        .reduce((s, p) => s + p.score, 0) ?? 0
    );
  }
  get offers() {
    return offersFor(this.data, this.phase);
  }
  get eligible() {
    return this.offers.filter(
      (id) =>
        this.chosen.includes(id) && this.data.phases[this.phase].scores[id] > 0,
    );
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
    this.result = scoreSelection(this.data, this.chosen);
    this.stage = "match";
  }
  claim(id: string) {
    if (
      this.stage !== "match" ||
      !this.eligible.includes(id) ||
      this.claimed.includes(id)
    )
      return false;
    const c = this.data.controls.find((c) => c.id === id)!;
    this.towers.push({
      uid: `${this.phase}-${id}`,
      controlId: id,
      category: c.category,
      level: this.data.phases[this.phase].scores[id],
      pad: null,
    });
    this.claimed.push(id);
    return true;
  }
  finishMatching() {
    if (this.stage !== "match") return;
    if (this.eligible.some((id) => !this.claimed.includes(id)))
      throw Error("Collect your matching cards first.");
    this.stage = "deploy";
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
        throw Error("Place all earned towers before starting.");
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
    } else this.stage = "question";
  }
  answer(question: Question, answer: string | null) {
    if (
      this.stage !== "question" ||
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
  nextPhase() {
    if (this.stage !== "question" || this.answers.length !== this.phase + 1)
      return;
    if (this.phase < 3) {
      this.phase++;
      this.claimed = [];
      this.stage = "match";
    } else this.stage = "intermission";
  }
}
