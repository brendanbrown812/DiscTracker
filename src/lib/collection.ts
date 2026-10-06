import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { discs, events } from "./schema";
import type { DiscInput } from "./validation";

export function allDiscs() {
  return db().select().from(discs).orderBy(desc(discs.createdAt)).all();
}
export function getDisc(id: string) {
  return db().select().from(discs).where(eq(discs.id, id)).get();
}
export function discHistory(id: string) {
  return db()
    .select()
    .from(events)
    .where(eq(events.discId, id))
    .orderBy(desc(events.createdAt))
    .all();
}
export function createDisc(input: DiscInput, photo: string | null) {
  const now = new Date().toISOString();
  const disc = {
    ...input,
    id: randomUUID(),
    photo,
    createdAt: now,
    updatedAt: now,
  };
  db().transaction((tx) => {
    tx.insert(discs).values(disc).run();
    tx.insert(events)
      .values({
        id: randomUUID(),
        discId: disc.id,
        kind: "Added",
        location: input.location,
        detail: input.locationDetail,
        lostAt: input.lostAt,
        createdAt: now,
      })
      .run();
  });
  return disc;
}
export function updateDisc(id: string, input: DiscInput, photo: string | null) {
  const previous = getDisc(id);
  if (!previous) return undefined;
  const now = new Date().toISOString();
  db().transaction((tx) => {
    tx.update(discs)
      .set({ ...input, photo, updatedAt: now })
      .where(eq(discs.id, id))
      .run();
    if (
      input.location !== previous.location ||
      input.locationDetail !== previous.locationDetail ||
      input.lostAt !== previous.lostAt
    ) {
      const kind =
        input.location === "Lost" && previous.location !== "Lost"
          ? "Lost"
          : previous.location === "Lost" && input.location !== "Lost"
            ? "Recovered"
            : "Moved";
      tx.insert(events)
        .values({
          id: randomUUID(),
          discId: id,
          kind,
          location: input.location,
          detail: input.locationDetail,
          lostAt: input.lostAt,
          createdAt: now,
        })
        .run();
    }
  });
  return getDisc(id);
}
export function deleteDisc(id: string) {
  return db().delete(discs).where(eq(discs.id, id)).run();
}
