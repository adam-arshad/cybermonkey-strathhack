import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Run, offersFor, STARTER } from "../src/core/run.ts";
import { Battle, waveSpec } from "../src/core/combat.ts";
import { PADS } from "../src/core/map.ts";
import { scoreSelection } from "../src/core/controls.mjs";
import type { Scenario, Question } from "../src/core/types.ts";
const data = JSON.parse(
  readFileSync(new URL("../src/data/challenge.json", import.meta.url), "utf8"),
) as Scenario;
const questions = JSON.parse(
  readFileSync(new URL("../src/data/questions.json", import.meta.url), "utf8"),
).questions as Question[];
function ready() {
  const r = new Run(data, questions, () => 0.5);
  r.chosen = [...STARTER];
  r.lock();
  r.beginMatching();
  return r;
}
function completeCheckpoint(r: Run, correct = true) {
  do {
    r.answer(correct ? r.currentQuestion.correct : null);
  } while (r.nextQuestion());
}
function fight(r: Run) {
  const b = new Battle(r.towers, r.health, r.phase, r.survivalWave);
  for (let i = 0; i < 20000 && !b.done; i++) b.step(1 / 60);
  assert.equal(b.done, true, "Wave must terminate");
  r.finishBattle(b.health, b.kills, b.leaks);
  return b;
}

test("budget/category/duplicate validation preserves the supplied scoring engine", () => {
  assert.throws(
    () => scoreSelection(data, ["P2", "P9", "D6", "R2"]),
    /Over budget/,
  );
  assert.throws(() => scoreSelection(data, ["P1"]), /Missing/);
  assert.throws(
    () => scoreSelection(data, ["P3", "D3", "R1", "P3"]),
    /chosen twice/,
  );
  const result = scoreSelection(data, ["P3", "D3", "R1"]);
  assert.deepEqual(
    result.phases.map((p) => p.score),
    [2, 3, 2, 2],
  );
  assert.equal(result.total, 9);
});
test("the control-card deck has 22 unique controls and preserves listed totals", () => {
  assert.equal(data.controls.length, 22);
  assert.equal(new Set(data.controls.map((control) => control.id)).size, 22);
  const totals = Object.fromEntries(
    data.controls.map((control) => [
      control.id,
      data.phases.reduce((sum, phase) => sum + phase.scores[control.id], 0),
    ]),
  );
  assert.deepEqual(totals, {
    P1: 4, P2: 4, P3: 0, P4: 4, P5: 4, P6: 3, P7: 2, P8: 1, P9: 3,
    D1: 6, D2: 3, D3: 0, D4: 0, D5: 2, D6: 11, D7: 2,
    R1: 9, R2: 8, R3: 1, R4: 3, R5: 0, R6: 3,
  });
});
test("shop blocks overspend, removal works, and locking freezes purchases", () => {
  const r = new Run(data, questions, () => 0.5);
  r.toggle("P2");
  r.toggle("P9");
  r.toggle("D6");
  assert.throws(() => r.toggle("R2"), /remaining budget/);
  r.toggle("D6");
  assert.equal(r.spent, 2000000);
  r.toggle("R1");
  r.toggle("D3");
  r.lock();
  assert.throws(() => r.toggle("P3"), /locked/);
});
test("phase reveals have nine unique cards, exactly three in each category", () => {
  for (let i = 0; i < 4; i++) {
    const cards = offersFor(data, i);
    assert.equal(new Set(cards).size, 9);
    for (const c of ["Prevent", "Detect", "Respond"])
      assert.equal(
        cards.filter(
          (id) => data.controls.find((x) => x.id === id)?.category === c,
        ).length,
        3,
      );
  }
});
test("matches cannot be claimed twice or claimed without owning a board card", () => {
  const r = ready();
  const id = r.eligible[0];
  assert.equal(r.claim(id, id), true);
  assert.equal(r.claim(id, id), false);
  assert.equal(r.claim("invalid", "invalid"), false);
  assert.equal(r.towers.length, 1);
  assert.equal(r.towers[0].level, 3);
  assert.throws(() => r.finishMatching(), /Place every/);
});
test("matching opens questions before tower deployment", () => {
  const r = ready();
  r.eligible.forEach((id) => r.claim(id, id));
  r.finishMatching();
  assert.equal(r.stage, "question");
  assert.equal(r.startBattle(), false);
  assert.equal(r.place(r.pending[0].uid, -1), false);
  completeCheckpoint(r);
  assert.equal(r.finishQuestions(), true);
  assert.equal(r.stage, "deploy");
  assert.equal(r.place(r.pending[0].uid, 0), true);
  assert.equal(r.place(r.pending[0].uid, 0), false);
  r.autoPlace();
  assert.equal(r.pending.length, 0);
  assert.equal(new Set(r.towers.map((t) => t.pad)).size, r.towers.length);
  assert.ok(PADS.length >= 36);
});
test("full four-phase run awards quizzes once, scores only matches, and enters survival", () => {
  const r = ready();
  for (let phase = 0; phase < 4; phase++) {
    if (phase > 0) {
      assert.equal(r.stage, "story");
      assert.deepEqual(r.deck, STARTER);
      r.beginMatching();
    }
    r.eligible.forEach((id) => r.claim(id, id));
    assert.equal(r.phaseScore, [13, 7, 9, 9][phase]);
    r.finishMatching();
    assert.equal(r.stage, "question");
    assert.equal(r.phase, phase);
    assert.equal(r.questionIndex, 0);
    assert.equal(r.nextQuestion(), false, "An unanswered question cannot be skipped");
    assert.equal(r.startBattle(), false, "Questions must precede deployment");
    for (let index = 0; index < 5; index++) {
      const q = r.currentQuestion;
      assert.equal(r.questionIndex, index);
      assert.ok(q.phase_id === null || q.phase_id === data.phases[phase].id);
      assert.equal(r.finishQuestions(), false);
      assert.equal(r.answer(q.correct), true);
      assert.equal(r.answer(q.correct), false);
      assert.equal(r.nextQuestion(), index < 4);
    }
    assert.equal(r.finishQuestions(), true);
    assert.equal(r.stage, "deploy");
    assert.throws(() => r.startBattle(), /Place all/);
    r.autoPlace();
    assert.equal(r.startBattle(), true);
    fight(r);
    assert.equal(r.stage, phase < 3 ? "story" : "intermission");
  }
  assert.equal(r.stage, "intermission");
  assert.equal(r.behaviour, 60);
  assert.equal(r.answers.length, 20);
  assert.equal(new Set(r.answers.map((a) => a.id)).size, 20);
  assert.equal(r.controlScore, 38);
  assert.equal(r.controlScore, r.towers.reduce((sum, t) => sum + t.level, 0));
  r.startBattle();
  assert.equal(r.health, 200);
  assert.equal(r.survivalWave, 1);
  let loops = 0;
  while (r.stage !== "gameover" && loops++ < 60) {
    fight(r);
    if (r.stage === "intermission") r.startBattle();
  }
  assert.equal(r.stage, "gameover");
  assert.ok(r.cleared >= 1);
  assert.ok(r.survivalWave < 60);
});
test("unanswered quiz grants no bonus and still allows the next phase", () => {
  const r = ready();
  r.eligible.forEach((id) => r.claim(id, id));
  r.finishMatching();
  assert.equal(r.answer(null), true);
  completeCheckpoint(r, false);
  assert.equal(r.behaviour, 0);
  assert.equal(r.correctAnswers, 0);
  assert.equal(r.phase, 0);
  assert.equal(r.finishQuestions(), true);
  r.autoPlace();
  assert.equal(r.startBattle(), true);
  fight(r);
  assert.equal(r.phase, 1);
  assert.equal(r.stage, "story");
});
test("zero towers never block rehearsal and survival eventually ends", () => {
  const rehearsal = new Battle([], 1, 0, 0);
  for (let i = 0; i < 10000 && !rehearsal.done; i++) rehearsal.step(1 / 60);
  assert.equal(rehearsal.done, true);
  assert.equal(rehearsal.health, 1);
  const survival = new Battle([], 20, 3, 1);
  for (let i = 0; i < 10000 && !survival.done; i++) survival.step(1 / 60);
  assert.equal(survival.done, true);
  assert.equal(survival.health, 0);
});
test("survival increases enemy count and health, while practice waves stay gentle", () => {
  assert.ok(waveSpec(3, 2).hp > waveSpec(3, 1).hp);
  assert.ok(waveSpec(3, 2).count > waveSpec(3, 1).count);
  assert.ok(waveSpec(3, 0).hp < waveSpec(3, 1).hp);
});

test("every pad lets a level-one tower attack the rehearsal route", () => {
  assert.ok(PADS.length >= 36, "Keep enough positions for all phase towers");
  for (const category of ["Prevent", "Detect", "Respond"] as const)
    for (let pad = 0; pad < PADS.length; pad++) {
      const battle = new Battle(
        [{ uid: "placement-check", controlId: "check", category, level: 1, pad }],
        100,
        0,
        0,
      );
      let fired = false;
      for (let tick = 0; tick < 5000 && !battle.done && !fired; tick++) {
        battle.step(1 / 60);
        fired = battle.shots.length > 0;
      }
      assert.ok(fired, `${category} tower cannot reach threats from pad ${pad + 1}`);
    }
});


test("ranked solutions follow the slides and the agreed phase-four board", () => {
  assert.deepEqual([0, 1, 2, 3].map((phase) => offersFor(data, phase)), [
    ["P6", "P7", "P1", "D1", "D6", "D2", "R2", "R1", "R3"],
    ["P2", "P4", "P8", "D6", "D1", "D5", "R2", "R1", "R6"],
    ["P5", "P4", "P2", "D6", "D7", "D1", "R2", "R1", "R6"],
    ["P9", "P2", "P5", "D6", "D1", "D2", "R4", "R1", "R2"],
  ]);
});
test("the phase story gates matching and purchases earn no automatic points", () => {
  const r = new Run(data, questions, () => 0.5);
  r.chosen = [...STARTER];
  r.lock();
  assert.equal(r.stage, "story");
  assert.equal(r.controlScore, 0);
  assert.equal(r.claim("P6", "P6"), false);
  r.finishMatching();
  assert.equal(r.stage, "story");
  r.beginMatching();
  assert.equal(r.stage, "match");
  assert.equal(r.claim("P6", "P6"), true);
  assert.equal(r.controlScore, 3);
  assert.equal(r.phaseScore, 3);
  assert.equal(r.deck.includes("P6"), false);
  assert.equal(r.chosen.includes("P6"), true);
});
test("wrong boxes, unowned cards and cards outside the board give no rewards", () => {
  const r = ready();
  assert.equal(r.claim("P6", "D1"), false);
  assert.equal(r.claim("P1", "P1"), false);
  assert.equal(r.claim("P5", "P5"), false);
  assert.equal(r.controlScore, 0);
  assert.deepEqual(r.deck, STARTER);
  assert.deepEqual(r.towers, []);
  assert.equal(r.claim("P6", "P6"), true);
  assert.equal(r.claim("P7", "P7"), true);
  assert.deepEqual(r.towers.map((t) => t.level), [3, 2]);
  assert.equal(r.controlScore, 5);
});
test("a phase with no owned matches can continue, and later stages reject claims", () => {
  const r = new Run(data, questions, () => 0.5);
  r.chosen = ["P3", "D3", "R5"];
  r.lock();
  r.beginMatching();
  assert.deepEqual(r.eligible, []);
  r.finishMatching();
  assert.equal(r.stage, "question");
  assert.equal(r.startBattle(), false);
  completeCheckpoint(r, false);
  assert.equal(r.finishQuestions(), true);
  assert.equal(r.startBattle(), true);
  assert.equal(r.claim("P3", "P3"), false);
  assert.equal(r.controlScore, 0);
});
test("all three ranks award the corresponding points and tower level", () => {
  const r = new Run(data, questions, () => 0.5);
  r.chosen = ["P6", "P7", "P1", "D2", "R3"];
  r.lock();
  r.beginMatching();
  for (const id of ["P6", "P7", "P1"]) assert.equal(r.claim(id, id), true);
  assert.deepEqual(r.towers.map((t) => t.level), [3, 2, 1]);
  assert.equal(r.controlScore, 6);
});


test("a wrong or invalid answer cannot earn rewards or bypass the active checkpoint", () => {
  const r = ready();
  assert.equal(r.answer(r.currentQuestion.correct), false);
  assert.equal(r.finishQuestions(), false);
  r.eligible.forEach((id) => r.claim(id, id));
  r.finishMatching();
  assert.equal(r.answer("Z"), false);
  assert.equal(r.answers.length, 0);
  const wrong = Object.keys(r.currentQuestion.options).find((key) => key !== r.currentQuestion.correct)!;
  assert.equal(r.answer(wrong), true);
  assert.equal(r.behaviour, 0);
  assert.equal(r.answer(r.currentQuestion.correct), false);
  assert.equal(r.startBattle(), false);
  completeCheckpoint(r, false);
  assert.equal(r.finishQuestions(), true);
  r.autoPlace();
  assert.equal(r.startBattle(), true);
});
test("the selected question and answer order stay stable throughout a checkpoint", () => {
  const r = ready();
  const snapshot = structuredClone(r.currentQuestion);
  const selected = r.currentQuestion;
  r.eligible.forEach((id) => r.claim(id, id));
  r.finishMatching();
  assert.strictEqual(r.currentQuestion, selected);
  r.health = 70;
  r.answer(r.currentQuestion.correct);
  assert.deepEqual(r.currentQuestion, snapshot);
  assert.equal(r.health, 80);
  assert.equal(r.behaviour, 3);
  assert.deepEqual(r.currentQuestion, snapshot);
  assert.equal(r.answer(r.currentQuestion.correct), false);
  assert.equal(r.health, 80);
});


test("checkpoint progress cannot advance outside the quiz or award a finished answer twice", () => {
  const r = ready();
  assert.equal(r.nextQuestion(), false);
  r.eligible.forEach((id) => r.claim(id, id));
  r.finishMatching();
  assert.equal(r.checkpointComplete, false);
  assert.equal(r.nextQuestion(), false);
  completeCheckpoint(r);
  assert.equal(r.checkpointComplete, true);
  assert.equal(r.questionIndex, 4);
  assert.equal(r.nextQuestion(), false);
  assert.equal(r.answer(r.currentQuestion.correct), false);
  assert.equal(r.behaviour, 15);
  assert.equal(r.finishQuestions(), true);
  assert.equal(r.stage, "deploy");
  assert.equal(r.nextQuestion(), false);
  assert.equal(r.answer(null), false);
});
