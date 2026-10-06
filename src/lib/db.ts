import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export function dataDir() {
  return path.resolve(
    /* turbopackIgnore: true */ process.env.DATA_DIR || "./data",
  );
}
function openDatabase() {
  mkdirSync(dataDir(), { recursive: true });
  const sqlite = new Database(path.join(dataDir(), "disctracker.sqlite"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  // Numbered, transactional migrations run on first access after an upgrade.
  const version = sqlite.pragma("user_version", { simple: true }) as number;
  if (version < 1)
    sqlite.transaction(() => {
      sqlite.exec(`
      CREATE TABLE discs (
        id TEXT PRIMARY KEY, api_id TEXT, name TEXT NOT NULL, brand TEXT NOT NULL,
        category TEXT NOT NULL, plastic TEXT NOT NULL, color TEXT NOT NULL, weight REAL,
        speed REAL, glide REAL, turn REAL, fade REAL, location TEXT NOT NULL,
        location_detail TEXT NOT NULL, purchased_at TEXT, purchased_from TEXT NOT NULL,
        lost_at TEXT, notes TEXT NOT NULL, photo TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE events (
        id TEXT PRIMARY KEY, disc_id TEXT NOT NULL REFERENCES discs(id) ON DELETE CASCADE,
        kind TEXT NOT NULL, location TEXT NOT NULL, detail TEXT NOT NULL, lost_at TEXT, created_at TEXT NOT NULL
      );
      CREATE INDEX events_disc_idx ON events(disc_id);
      CREATE TABLE catalog_cache (key TEXT PRIMARY KEY, payload TEXT NOT NULL, fetched_at TEXT NOT NULL);
      PRAGMA user_version = 1;
    `);
    })();
  return { sqlite, orm: drizzle(sqlite, { schema }) };
}
const globalDb = globalThis as unknown as {
  discTrackerDb?: ReturnType<typeof openDatabase>;
};
export function db() {
  return (globalDb.discTrackerDb ??= openDatabase()).orm;
}
