import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { createHmac } from "node:crypto";
import { db } from "../src/lib/db";
import { parseDisc } from "../src/lib/validation";
import {
  allDiscs,
  createDisc,
  updateDisc,
  getDisc,
  deleteDisc,
  discHistory,
} from "../src/lib/collection";
import { photoPath, savePhoto, removePhoto } from "../src/lib/photos";
import { checkOrigin } from "../src/lib/http";
import { passwordMatches, validSession } from "../src/lib/auth";
import { GET as catalog } from "../src/app/api/catalog/route";
import { catalogCache } from "../src/lib/schema";
import { prepareLocationChange } from "../src/lib/location";
import { locations } from "../src/lib/types";

const directory = mkdtempSync(path.join(tmpdir(), "disctracker-tests-"));
process.env.DATA_DIR = directory;
const input = {
  apiId: "catalog-mold",
  name: "Destroyer",
  brand: "Innova",
  category: "Distance Driver",
  plastic: "Star",
  color: "Blue",
  weight: 175,
  speed: 12,
  glide: 5,
  turn: -1,
  fade: 3,
  location: "In Bag",
  locationDetail: "Main bag",
  purchasedAt: null,
  purchasedFrom: "Local shop",
  lostAt: null,
  notes: "Forehand driver",
};
after(() => {
  db().$client.close();
  rmSync(directory, { recursive: true, force: true });
});

test("validation rejects invalid dates, weights, locations, and flight ratings", () => {
  assert.throws(() => parseDisc({ ...input, purchasedAt: "2026-02-30" }));
  assert.throws(() => parseDisc({ ...input, weight: -1 }));
  assert.throws(() => parseDisc({ ...input, location: "Garage" }));
  assert.throws(() => parseDisc({ ...input, speed: 99 }));
  assert.throws(() => parseDisc({ ...input, location: "Lost" }));
  assert.equal(parseDisc({ ...input, lostAt: "2026-10-06" }).lostAt, null);
});

test("two physical copies stay independent, preserve their flight snapshots and loss history", () => {
  const first = createDisc(parseDisc(input), null);
  const second = createDisc(
    parseDisc({ ...input, color: "Pink", weight: 169 }),
    null,
  );
  assert.notEqual(first.id, second.id);
  assert.equal(allDiscs().length, 2);
  const lost = parseDisc({
    ...input,
    location: "Lost",
    locationDetail: "Hole 8 pond",
    lostAt: "2026-10-06",
  });
  updateDisc(first.id, lost, null);
  assert.equal(getDisc(first.id)?.lostAt, "2026-10-06");
  assert.equal(getDisc(second.id)?.location, "In Bag");
  updateDisc(
    first.id,
    parseDisc({ ...input, location: "Storage", locationDetail: "Shelf 2" }),
    null,
  );
  assert.equal(getDisc(first.id)?.lostAt, null);
  assert.equal(getDisc(first.id)?.speed, 12);
  assert.equal(getDisc(first.id)?.createdAt, first.createdAt);
  assert.deepEqual(
    discHistory(first.id)
      .map((e) => e.kind)
      .sort(),
    ["Added", "Lost", "Recovered"].sort(),
  );
  assert.equal(
    discHistory(first.id).find((e) => e.kind === "Lost")?.lostAt,
    "2026-10-06",
  );
  deleteDisc(first.id);
  deleteDisc(second.id);
  assert.equal(discHistory(first.id).length, 0);
  assert.equal(allDiscs().length, 0);
});

test("every location shortcut preserves disc data and records moves, losses, and recoveries only after saving", () => {
  for (const source of locations) {
    for (const destination of locations.filter((location) => location !== source)) {
      const original = createDisc(parseDisc({
        ...input, location: source, lostAt: source === "Lost" ? "2026-10-05" : null,
      }), "fixture.jpg");
      try {
        const snapshot = { ...original };
        const draft = prepareLocationChange(original, destination, "2026-10-06");
        assert.deepEqual(original, snapshot, "preparing a change must not mutate the original");
        assert.equal(getDisc(original.id)?.location, source, "a shortcut is a draft until saved");
        assert.equal(discHistory(original.id).length, 1);
        assert.equal(draft.location, destination);
        assert.equal(draft.locationDetail, "", "old bag or loss details must not describe the new location");
        assert.equal(draft.lostAt, destination === "Lost" ? "2026-10-06" : null);
        assert.deepEqual(draft, {
          ...original, location: destination, locationDetail: "",
          lostAt: destination === "Lost" ? "2026-10-06" : null,
        });
        const saved = updateDisc(original.id, parseDisc(draft), draft.photo);
        assert.ok(saved);
        assert.equal(saved.location, destination);
        assert.equal(saved.lostAt, draft.lostAt);
        assert.equal(saved.photo, original.photo);
        assert.equal(saved.createdAt, original.createdAt);
        assert.equal(saved.speed, original.speed);
        const history = discHistory(original.id);
        assert.equal(history.length, 2);
        const move = history.find((event) => event.location === destination)!;
        assert.equal(move.kind, destination === "Lost" ? "Lost" : source === "Lost" ? "Recovered" : "Moved");
        assert.equal(move.lostAt, draft.lostAt);
      } finally {
        deleteDisc(original.id);
      }
    }
  }
});

test("photo uploads decode, normalize, strip metadata, and remove safely", async () => {
  const image = await sharp({
    create: { width: 2000, height: 1000, channels: 3, background: "blue" },
  })
    .png()
    .toBuffer();
  const filename = await savePhoto(
    new File([new Uint8Array(image)], "disc.png", { type: "image/png" }),
  );
  assert.ok(existsSync(photoPath(filename)));
  const metadata = await sharp(photoPath(filename)).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.width, 1400);
  assert.equal(metadata.exif, undefined);
  await assert.rejects(() =>
    savePhoto(new File(["not an image"], "disc.jpg", { type: "image/jpeg" })),
  );
  await assert.rejects(() =>
    savePhoto(new File(["<svg/>"], "disc.svg", { type: "image/svg+xml" })),
  );
  await removePhoto(filename);
  assert.equal(existsSync(photoPath(filename)), false);
});

test("mutation origin checks reject cross-site and missing origins", () => {
  checkOrigin(
    new Request("http://localhost:3000/api/discs", {
      headers: { Origin: "http://localhost:3000" },
    }),
  );
  checkOrigin(
    new Request("http://localhost:3000/api/discs", {
      headers: { Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000" },
    }),
  );
  assert.throws(() =>
    checkOrigin(
      new Request("http://localhost:3000/api/discs", {
        headers: { Origin: "https://other.example" },
      }),
    ),
  );
  assert.throws(() =>
    checkOrigin(new Request("http://localhost:3000/api/discs")),
  );
});

test("owner session expires and password changes invalidate signed sessions", () => {
  process.env.ADMIN_PASSWORD = "test-password";
  process.env.SESSION_SECRET = "test-secret-longer-than-thirty-two-characters";
  const token = (expiration: number) => {
    const value = `${expiration}.abc123`;
    const sig = createHmac("sha256", process.env.SESSION_SECRET!)
      .update(`${process.env.ADMIN_PASSWORD}\0${value}`)
      .digest("hex");
    return `${value}.${sig}`;
  };
  assert.equal(passwordMatches("wrong"), false);
  assert.equal(passwordMatches("test-password"), true);
  const valid = token(Date.now() + 60000);
  assert.equal(validSession(valid), true);
  assert.equal(validSession(token(Date.now() - 1000)), false);
  assert.equal(validSession(valid + "extra"), false);
  process.env.ADMIN_PASSWORD = "new-password";
  assert.equal(validSession(valid), false);
  delete process.env.ADMIN_PASSWORD;
  delete process.env.SESSION_SECRET;
});

test("catalog caches upstream flight numbers and falls back to saved results during outages", async () => {
  const original = globalThis.fetch;
  let fetches = 0;
  const upstream = [
    {
      id: "mold-1",
      name: "Destroyer",
      brand: "Innova",
      category: "Distance Driver",
      speed: "12",
      glide: "5",
      turn: "-1",
      fade: "3",
    },
  ];
  globalThis.fetch = async () => {
    fetches++;
    return Response.json(upstream);
  };
  try {
    const first = await catalog(
      new Request("http://localhost:3000/api/catalog?q=Destroyer"),
    );
    assert.equal(first.status, 200);
    assert.equal((await first.json()).molds[0].speed, 12);
    await catalog(new Request("http://localhost:3000/api/catalog?q=destroyer"));
    assert.equal(fetches, 1);
    db()
      .update(catalogCache)
      .set({ fetchedAt: "2000-01-01T00:00:00Z" })
      .where(eq(catalogCache.key, "destroyer"))
      .run();
    globalThis.fetch = async () => {
      throw new Error("Offline");
    };
    const fallback = await catalog(
      new Request("http://localhost:3000/api/catalog?q=destroyer"),
    );
    const body = await fallback.json();
    assert.equal(body.cached, true);
    assert.equal(body.molds[0].turn, -1);
    const missing = await catalog(
      new Request("http://localhost:3000/api/catalog?q=unknown"),
    );
    assert.equal(missing.status, 503);
    assert.match((await missing.json()).error, /manually/);
  } finally {
    globalThis.fetch = original;
  }
});
