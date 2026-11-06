import { z } from "zod";

export const practicePlan = z
  .array(
    z.object({
      distance: z.number().int().min(1).max(300),
      attempts: z.number().int().min(1).max(500),
    }),
  )
  .min(1)
  .max(30)
  .refine(
    (rows) => rows.reduce((sum, row) => sum + row.attempts, 0) <= 3000,
    "Limit a session to 3,000 putts",
  );
export const practiceRounds = z
  .array(
    z.object({
      distance: z.number().int().min(1).max(300),
      attempts: z.number().int().min(1).max(500),
      results: z.array(z.boolean()).max(500),
    }),
  )
  .min(1)
  .max(30)
  .superRefine((rows, ctx) => {
    let unfinished = false;
    for (const row of rows) {
      if (
        row.results.length > row.attempts ||
        (unfinished && row.results.length > 0)
      )
        ctx.addIssue({
          code: "custom",
          message:
            "Record putts in round order without exceeding the planned attempts",
        });
      if (row.results.length < row.attempts) unfinished = true;
    }
  });
export type PracticeRound = z.infer<typeof practiceRounds>[number];
export type PracticeSession = {
  id: string;
  rounds: PracticeRound[];
  createdAt: string;
  completedAt: string | null;
  revision: number;
};
export function practiceStats(sessions: PracticeSession[]) {
  const distances = new Map<
    number,
    { distance: number; makes: number; attempts: number }
  >();
  for (const session of sessions)
    for (const round of session.rounds) {
      const value = distances.get(round.distance) || {
        distance: round.distance,
        makes: 0,
        attempts: 0,
      };
      value.makes += round.results.filter(Boolean).length;
      value.attempts += round.results.length;
      distances.set(round.distance, value);
    }
  return [...distances.values()].sort((a, b) => a.distance - b.distance);
}
