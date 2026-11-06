import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { db } from "../src/lib/db";
import {
  createPractice,
  listPractice,
  updatePractice,
} from "../src/lib/putting-store";
import {
  practicePlan,
  practiceRounds,
  practiceStats,
} from "../src/lib/putting";
const directory = mkdtempSync(
  path.join(tmpdir(), "disctracker-putting-tests-"),
);
process.env.DATA_DIR = directory;
after(() => {
  db().$client.close();
  rmSync(directory, { recursive: true, force: true });
});
test("practice plans enforce bounded positive distances and putt counts", () => {
  for (const value of [
    [],
    [{ distance: 0, attempts: 30 }],
    [{ distance: 10, attempts: 0 }],
    [{ distance: 10, attempts: 1.5 }],
    Array.from({ length: 7 }, () => ({ distance: 10, attempts: 500 })),
  ])
    assert.equal(practicePlan.safeParse(value).success, false);
  assert.equal(
    practicePlan.parse([
      { distance: 20, attempts: 30 },
      { distance: 15, attempts: 25 },
      { distance: 10, attempts: 20 },
    ]).length,
    3,
  );
  assert.equal(
    practiceRounds.safeParse([
      { distance: 10, attempts: 1, results: [true, false] },
    ]).success,
    false,
  );
  assert.equal(
    practiceRounds.safeParse([
      { distance: 10, attempts: 2, results: [] },
      { distance: 20, attempts: 1, results: [true] },
    ]).success,
    false,
  );
});
test("practice saves, resumes, undoes, rejects stale updates, and completes with accurate distance stats", () => {
  const created = createPractice([
    { distance: 20, attempts: 2 },
    { distance: 10, attempts: 1 },
  ]);
  assert.equal(created.completedAt, null);
  const first = updatePractice(created.id, 0, [
    { distance: 20, attempts: 2, results: [true] },
    { distance: 10, attempts: 1, results: [] },
  ]);
  assert.deepEqual(listPractice()[0], first);
  assert.throws(
    () => updatePractice(created.id, 0, first.rounds),
    /another device/,
  );
  assert.throws(
    () =>
      updatePractice(created.id, 1, [
        { distance: 30, attempts: 2, results: [true] },
        { distance: 10, attempts: 1, results: [] },
      ]),
    /plan cannot change/,
  );
  const undone = updatePractice(created.id, 1, created.rounds);
  assert.equal(undone.rounds[0].results.length, 0);
  const done = updatePractice(created.id, 2, [
    { distance: 20, attempts: 2, results: [true, false] },
    { distance: 10, attempts: 1, results: [true] },
  ]);
  assert.ok(done.completedAt);
  assert.deepEqual(practiceStats([done]), [
    { distance: 10, makes: 1, attempts: 1 },
    { distance: 20, makes: 1, attempts: 2 },
  ]);
  assert.throws(
    () => updatePractice(done.id, 3, done.rounds),
    /already complete/,
  );
  assert.equal(db().$client.pragma("user_version", { simple: true }), 2);
});
