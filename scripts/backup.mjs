import Database from "better-sqlite3";
import { cp, mkdir, access, writeFile } from "node:fs/promises";
import path from "node:path";

// Stop the app first so photos and the database represent the same moment.
const source = path.resolve(process.env.DATA_DIR || "./data");
const destination = path.resolve(
  "backups",
  new Date().toISOString().replace(/[:.]/g, "-"),
);
await access(path.join(source, "disctracker.sqlite"));
await mkdir(destination, { recursive: true });
const db = new Database(path.join(source, "disctracker.sqlite"), {
  readonly: true,
});
await db.backup(path.join(destination, "disctracker.sqlite"));
db.close();
try {
  await access(path.join(source, "photos"));
  await cp(path.join(source, "photos"), path.join(destination, "photos"), {
    recursive: true,
  });
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
await writeFile(
  path.join(destination, "README.txt"),
  "DiscTracker backup. Stop the app and replace the contents of DATA_DIR with disctracker.sqlite and photos/ from this folder. Keep a copy of the existing data first.\n",
);
console.log(`Backup saved to ${destination}`);
