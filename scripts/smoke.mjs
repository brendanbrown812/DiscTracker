// End-to-end checks against a real production server and an isolated database.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
const directory = await mkdtemp(path.join(tmpdir(), "disctracker-smoke-"));
const origin = "http://127.0.0.1:3101";
// Connect locally, but exercise the configured LAN origin like a mapped Docker port.
const lanOrigin = "http://10.0.0.16:3009";
const password = randomBytes(20).toString("hex");
const secret = randomBytes(32).toString("hex");
let server;
let serverOutput = "";
async function stop() {
  if (!server || server.exitCode !== null) return;
  const exit = new Promise((resolve) => server.once("exit", resolve));
  server.kill();
  await exit;
}
async function start(auth, appUrl = lanOrigin) {
  serverOutput = "";
  server = spawn(
    process.execPath,
    ["scripts/start-local.mjs"],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        DATA_DIR: path.relative(process.cwd(), directory),
        PORT: "3101",
        APP_URL: appUrl,
        ADMIN_PASSWORD: auth ? password : "",
        SESSION_SECRET: auth ? secret : "",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  server.stdout.on("data", (chunk) => {
    serverOutput += chunk;
  });
  server.stderr.on("data", (chunk) => {
    serverOutput += chunk;
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(serverOutput);
    try {
      if ((await fetch(`${origin}/api/auth`)).ok) {
        assert.doesNotMatch(serverOutput, /does not work with.*standalone/);
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Production server did not start: " + serverOutput);
}
const input = {
  apiId: null,
  name: "Smoke test disc",
  brand: "Test manufacturer",
  category: "Putter",
  plastic: "Test",
  color: "Blue",
  weight: 175,
  speed: 3,
  glide: 4,
  turn: 0,
  fade: 1,
  location: "In Bag",
  locationDetail: "Main bag",
  purchasedAt: "2026-10-01",
  purchasedFrom: "Test store",
  lostAt: null,
  notes: "Temporary test data",
};
function body(disc = input, photo) {
  const form = new FormData();
  form.set("data", JSON.stringify(disc));
  if (photo)
    form.set("photo", new File([photo], "fixture.png", { type: "image/png" }));
  return form;
}
try {
  await start(false);
  assert.equal(
    (await (await fetch(`${origin}/api/auth`)).json()).canEdit,
    false,
  );
  assert.equal(
    (
      await fetch(`${origin}/api/discs`, {
        method: "POST",
        headers: { Origin: origin },
        body: body(),
      })
    ).status,
    401,
  );
  console.log("PASS: production without credentials rejects editing");
  await stop();
  await start(true);
  for (const rejectedOrigin of [undefined, "http://10.0.0.16:3000"]) {
    assert.equal(
      (
        await fetch(`${origin}/api/auth`, {
          method: "POST",
          headers: {
            ...(rejectedOrigin ? { Origin: rejectedOrigin } : {}),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password }),
        })
      ).status,
      403,
    );
  }
  assert.equal(
    (
      await fetch(`${origin}/api/auth`, {
        method: "POST",
        headers: {
          Origin: "https://other.example",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(`${origin}/api/auth`, {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrong" }),
      })
    ).status,
    401,
  );
  const login = await fetch(`${origin}/api/auth`, {
    method: "POST",
    headers: { Origin: lanOrigin, "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get("set-cookie");
  assert.match(setCookie, /;\s*HttpOnly(?:;|$)/i);
  assert.match(setCookie, /;\s*SameSite=Strict(?:;|$)/i);
  assert.doesNotMatch(setCookie, /;\s*Secure(?:;|$)/i);
  const cookie = setCookie.split(";")[0];
  const headers = { Origin: lanOrigin, Cookie: cookie };
  assert.equal(
    (await (await fetch(`${origin}/api/auth`, { headers })).json()).canEdit,
    true,
  );
  assert.equal(
    (
      await fetch(`${origin}/api/discs`, {
        method: "POST",
        headers: { ...headers, Origin: "https://other.example" },
        body: body(),
      })
    ).status,
    403,
  );
  console.log("PASS: LAN HTTP owner login, cookie flags, and origin/port protection");
  const image = await sharp({
    create: { width: 100, height: 100, channels: 3, background: "blue" },
  })
    .png()
    .toBuffer();
  const createdResponse = await fetch(`${origin}/api/discs`, {
    method: "POST",
    headers,
    body: body(input, image),
  });
  const created = await createdResponse.json();
  assert.equal(createdResponse.status, 201, JSON.stringify(created));
  await access(path.join(directory, "disctracker.sqlite"));
  const photo = await fetch(`${origin}/api/photos/${created.photo}`);
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get("content-type"), "image/jpeg");
  const lost = {
    ...input,
    location: "Lost",
    locationDetail: "Hole 8",
    lostAt: "2026-10-06",
  };
  assert.equal(
    (
      await fetch(`${origin}/api/discs/${created.id}`, {
        method: "PUT",
        headers,
        body: body(lost),
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await fetch(`${origin}/api/discs/${created.id}`, {
        method: "PUT",
        headers,
        body: body(input),
      })
    ).status,
    200,
  );
  const detail = await (
    await fetch(`${origin}/api/discs/${created.id}`)
  ).json();
  assert.equal(detail.disc.lostAt, null);
  assert.equal(detail.history.length, 3);
  assert.equal(detail.disc.photo, created.photo);
  const exported = await (
    await fetch(`${origin}/api/export`, { headers })
  ).json();
  assert.equal(exported.discs[0].history.length, 3);
  console.log("PASS: photo upload, edits, loss/recovery history, and export");
  await stop();
  await start(true);
  const persisted = await (await fetch(`${origin}/api/discs`)).json();
  assert.equal(persisted[0].id, created.id);
  assert.equal((await fetch(`${origin}/api/photos/${created.photo}`)).status, 200);
  assert.equal(
    (
      await fetch(`${origin}/api/discs/${created.id}`, {
        method: "DELETE",
        headers,
      })
    ).status,
    200,
  );
  assert.equal((await fetch(`${origin}/api/discs/${created.id}`)).status, 404);
  assert.equal(
    (await fetch(`${origin}/api/photos/${created.photo}`)).status,
    404,
  );
  console.log("PASS: persistence across restart and delete cleanup");
  const html = await (await fetch(origin)).text();
  assert.ok(html.includes("Your collection"));
  const scripts = [...html.matchAll(/src="([^" ]+\.js[^" ]*)"/g)].map(
    (match) => match[1],
  );
  assert.ok(scripts.length > 0);
  for (const src of scripts)
    assert.equal(
      (await fetch(new URL(src.replace(/&amp;/g, "&"), origin))).status,
      200,
    );
  const styles = [...html.matchAll(/href="([^" ]+\.css[^" ]*)"/g)].map(match => match[1]);
  assert.ok(styles.length > 0);
  for (const href of styles) assert.equal((await fetch(new URL(href.replace(/&amp;/g, "&"), origin))).status, 200);
  assert.equal((await fetch(`${origin}/favicon.svg`)).status, 200);
  console.log("PASS: standalone startup, production page, JavaScript, CSS, and favicon");
  await stop();
  const httpsOrigin = "https://discs.example.com";
  await start(true, httpsOrigin);
  const httpsLogin = await fetch(`${origin}/api/auth`, {
    method: "POST",
    headers: { Origin: httpsOrigin, "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  assert.equal(httpsLogin.status, 200);
  assert.match(httpsLogin.headers.get("set-cookie"), /;\s*Secure(?:;|$)/i);
  assert.match(httpsLogin.headers.get("set-cookie"), /;\s*HttpOnly(?:;|$)/i);
  assert.match(httpsLogin.headers.get("set-cookie"), /;\s*SameSite=Strict(?:;|$)/i);
  console.log("PASS: switching APP_URL to HTTPS enables Secure session cookies");
} finally {
  await stop();
  // This directory was created by this test and contains only its own fixtures.
  await rm(directory, { recursive: true, force: true });
}
