import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

test("launcher prepares a private first-run config and preserves existing settings", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "disctracker-launcher-"));
  const script = path.resolve("scripts/prepare-local.mjs");
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production" };
  delete env.ADMIN_PASSWORD;
  delete env.SESSION_SECRET;
  const run = () => spawnSync(process.execPath, [script], { cwd: directory, env, encoding: "utf8", windowsHide: true });
  try {
    writeFileSync(path.join(directory, ".env.example"), readFileSync(".env.example"));
    const initial = run();
    assert.equal(initial.status, 2, initial.stderr);
    const settingsPath = path.join(directory, ".env.local");
    const settings = readFileSync(settingsPath, "utf8");
    const secret = settings.match(/^SESSION_SECRET=([a-f0-9]{64})/m)?.[1];
    assert.ok(secret);
    assert.ok(settings.includes("APP_URL=http://127.0.0.1:3000"));
    assert.equal(initial.stdout.includes(secret), false);
    assert.equal(run().status, 2);
    assert.equal(readFileSync(settingsPath, "utf8"), settings);
    const configured = settings.replace(/^ADMIN_PASSWORD=.*$/m, "ADMIN_PASSWORD=test-fixture-password");
    writeFileSync(settingsPath, configured);
    assert.equal(run().status, 0);
    assert.equal(readFileSync(settingsPath, "utf8"), configured);
    rmSync(settingsPath);
    writeFileSync(path.join(directory, ".env"), "ADMIN_PASSWORD=existing-fixture-password\nSESSION_SECRET=too-short\n");
    assert.equal(run().status, 1);
    assert.equal(existsSync(settingsPath), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("standalone launcher loads root settings, resolves data paths, and supplies static assets", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "disc tracker standalone-"));
  const script = path.resolve("scripts/start-local.mjs");
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production" };
  for (const key of ["ADMIN_PASSWORD", "SESSION_SECRET", "DATA_DIR", "PORT", "HOSTNAME"]) delete env[key];
  try {
    const standalone = path.join(directory, ".next", "standalone");
    mkdirSync(standalone, { recursive: true });
    mkdirSync(path.join(directory, ".next", "static"), { recursive: true });
    mkdirSync(path.join(directory, "public"));
    writeFileSync(path.join(directory, ".next", "static", "fixture.css"), "body { color: green; }");
    writeFileSync(path.join(directory, "public", "favicon.svg"), "<svg/>");
    writeFileSync(path.join(directory, ".env.local"), "ADMIN_PASSWORD=fixture-password\nSESSION_SECRET=fixture-secret-with-more-than-32-characters\nDATA_DIR=./collection\n");
    writeFileSync(path.join(standalone, "server.js"), `
      process.chdir(__dirname);
      console.log(JSON.stringify({
        data: process.env.DATA_DIR,
        host: process.env.HOSTNAME,
        port: process.env.PORT,
        authenticated: process.env.ADMIN_PASSWORD === 'fixture-password',
        secretLoaded: process.env.SESSION_SECRET === 'fixture-secret-with-more-than-32-characters'
      }));
    `);
    const result = spawnSync(process.execPath, [script], { cwd: directory, env, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    const settings = JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1)!);
    assert.equal(settings.data, path.join(directory, "collection"));
    assert.equal(settings.host, "127.0.0.1");
    assert.equal(settings.port, "3000");
    assert.equal(settings.authenticated, true);
    assert.equal(settings.secretLoaded, true);
    assert.ok(existsSync(path.join(standalone, ".next", "static", "fixture.css")));
    assert.ok(existsSync(path.join(standalone, "public", "favicon.svg")));
    assert.equal(existsSync(path.join(standalone, ".env.local")), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
