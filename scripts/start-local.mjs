import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import nextEnv from "@next/env";

export function prepareStandalone(directory) {
  const project = path.resolve(directory);
  const standalone = path.join(project, ".next", "standalone");
  const server = path.join(standalone, "server.js");
  if (!existsSync(server)) {
    throw new Error("The production build is missing. Run npm run build first.");
  }

  process.env.NODE_ENV = "production";
  // Load the original project's settings before server.js changes the working
  // directory to .next/standalone. Never copy credentials into build output.
  nextEnv.loadEnvConfig(project, false);
  process.env.DATA_DIR = path.resolve(project, process.env.DATA_DIR || "./data");
  process.env.HOSTNAME = "127.0.0.1";
  process.env.PORT ||= "3000";

  // Next's standalone output excludes these assets by default.
  cpSync(path.join(project, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });
  cpSync(path.join(project, "public"), path.join(standalone, "public"), { recursive: true });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const server = prepareStandalone(process.cwd());
    await import(pathToFileURL(server).href);
  } catch (error) {
    console.error(`Could not start DiscTracker: ${error.message}`);
    process.exitCode = 1;
  }
}
