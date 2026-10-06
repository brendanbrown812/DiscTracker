import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

export function prepareLocal(directory) {
  const settings = path.join(directory, ".env.local");
  const logger = { info() {}, error() {} };
  const { combinedEnv } = nextEnv.loadEnvConfig(directory, false, logger, true);
  if (combinedEnv.ADMIN_PASSWORD && (combinedEnv.SESSION_SECRET?.length ?? 0) >= 32) {
    console.log("Owner login is configured.");
    return 0;
  }
  if (!existsSync(settings)) {
    // Preserve pre-existing production/Docker settings rather than shadowing them.
    if ([".env", ".env.production", ".env.production.local"].some(name => existsSync(path.join(directory, name)))) {
      console.error("Existing environment settings are incomplete. Set ADMIN_PASSWORD and a SESSION_SECRET of at least 32 characters in your existing .env file.");
      return 1;
    }
    const template = readFileSync(path.join(directory, ".env.example"), "utf8");
    const contents = template
      .replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${randomBytes(32).toString("hex")}`)
      .replace(/^APP_URL=.*$/m, "APP_URL=http://127.0.0.1:3000");
    writeFileSync(settings, contents, { flag: "wx", mode: 0o600 });
    console.log("Created .env.local with a random session secret. Choose your owner password before starting.");
    return 2;
  }
  console.error("Set ADMIN_PASSWORD and a SESSION_SECRET of at least 32 characters in .env.local. The existing file has been preserved.");
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = prepareLocal(process.cwd()); }
  catch (error) { console.error(`Could not prepare login settings: ${error.message}`); process.exitCode = 3; }
}
