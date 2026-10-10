import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selectPhaseQuestions, shuffleAnswers } from "../src/core/questions.ts";
import type { Question } from "../src/core/types.ts";

const bank = JSON.parse(readFileSync(new URL("../src/data/questions.json", import.meta.url), "utf8")).questions as Question[];
const phases = ["phase_1", "phase_2", "phase_3", "phase_4"];

test("four five-question checkpoints keep phase relevance and use no question twice", () => {
  const original = structuredClone(bank);
  for (let step = 0; step < 20; step++) {
    const selected = selectPhaseQuestions(bank, phases, () => step / 20);
    assert.deepEqual(selected.map((group) => group.length), [5, 5, 5, 5]);
    assert.equal(new Set(selected.flat().map((q) => q.id)).size, 20);
    selected.forEach((group, phase) => {
      assert.equal(group.filter((q) => q.phase_id === phases[phase]).length, [4, 4, 4, 3][phase]);
      group.forEach((q) => {
      assert.ok(q.phase_id === null || q.phase_id === phases[phase]);
      const source = bank.find((original) => original.id === q.id)!;
      assert.equal(q.question, source.question);
      assert.equal(q.explanation, source.explanation);
      assert.equal(q.options[q.correct], source.options[source.correct]);
      });
    });
  }
  assert.deepEqual(bank, original);
});
test("fresh runs shuffle both question sequence and answer positions", () => {
  const first = selectPhaseQuestions(bank, phases, () => 0);
  const second = selectPhaseQuestions(bank, phases, () => 0.999);
  assert.notDeepEqual(first.flat().map((q) => q.id), second.flat().map((q) => q.id));
  const question = bank[0];
  assert.notDeepEqual(shuffleAnswers(question, () => 0).options, shuffleAnswers(question, () => 0.999).options);
});
test("all 24 answer permutations preserve correctness, labels and original data", () => {
  const question = bank[0];
  const original = structuredClone(question);
  const orders = new Set<string>();
  const correctPositions = new Set<string>();
  for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 2; c++) {
    const choices = [a / 4, b / 3, c / 2];
    const shuffled = shuffleAnswers(question, () => choices.shift()!);
    assert.deepEqual(Object.keys(shuffled.options), ["A", "B", "C", "D"]);
    assert.deepEqual(Object.values(shuffled.options).sort(), Object.values(question.options).sort());
    assert.equal(shuffled.options[shuffled.correct], question.options[question.correct]);
    assert.equal(shuffled.explanation, question.explanation);
    orders.add(JSON.stringify(shuffled.options));
    correctPositions.add(shuffled.correct);
  }
  assert.equal(orders.size, 24);
  assert.equal(correctPositions.size, 4);
  assert.deepEqual(question, original);
});
test("missing phase content produces a clear error", () => {
  assert.throws(() => selectPhaseQuestions(bank, ["phase_missing"]), /5 unique relevant questions/);
});

test("an incomplete or duplicated question bank cannot silently create an invalid checkpoint", () => {
  assert.throws(() => selectPhaseQuestions(bank.filter((q) => q.phase_id !== "phase_1"), phases), /5 unique relevant questions/);
  assert.throws(() => selectPhaseQuestions([...bank, bank[0]], phases), /5 unique relevant questions/);
  assert.throws(() => selectPhaseQuestions(bank.filter((q) => q.phase_id !== null), phases), /5 unique relevant questions/);
});
