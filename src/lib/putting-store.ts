import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { puttingSessions } from "./schema";
import { practicePlan, practiceRounds, type PracticeSession } from "./putting";
import { HttpError } from "./http";

function decode(row: typeof puttingSessions.$inferSelect): PracticeSession {
  return { ...row, rounds: JSON.parse(row.rounds) };
}
export function listPractice() {
  return db()
    .select()
    .from(puttingSessions)
    .orderBy(desc(puttingSessions.createdAt))
    .all()
    .map(decode);
}
export function createPractice(input: unknown) {
  const rounds = practicePlan
    .parse(input)
    .map((row) => ({ ...row, results: [] }));
  const row = {
    id: randomUUID(),
    rounds: JSON.stringify(rounds),
    createdAt: new Date().toISOString(),
    completedAt: null,
    revision: 0,
  };
  db().insert(puttingSessions).values(row).run();
  return decode(row);
}
export function updatePractice(id: string, revision: number, input: unknown) {
  const old = db()
    .select()
    .from(puttingSessions)
    .where(eq(puttingSessions.id, id))
    .get();
  if (!old) throw new HttpError(404, "Practice not found.");
  if (old.completedAt)
    throw new HttpError(409, "This practice is already complete.");
  const rounds = practiceRounds.parse(input);
  const plan = decode(old).rounds;
  if (
    rounds.length !== plan.length ||
    rounds.some(
      (r, i) =>
        r.distance !== plan[i].distance || r.attempts !== plan[i].attempts,
    )
  )
    throw new HttpError(400, "The practice plan cannot change after starting.");
  const completedAt = rounds.every((r) => r.results.length === r.attempts)
    ? new Date().toISOString()
    : null;
  const saved = db()
    .update(puttingSessions)
    .set({
      rounds: JSON.stringify(rounds),
      completedAt,
      revision: revision + 1,
    })
    .where(
      and(eq(puttingSessions.id, id), eq(puttingSessions.revision, revision)),
    )
    .returning()
    .get();
  if (!saved)
    throw new HttpError(
      409,
      "This practice changed on another device. Reload to resume the latest saved progress.",
    );
  return decode(saved);
}
