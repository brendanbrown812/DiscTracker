import { test } from "node:test";
import assert from "node:assert/strict";
import { act, createElement } from "react";
import { JSDOM } from "jsdom";
import { FlightGuideView } from "../src/components/flight-guide";
import {
  buildFlightGuide,
  filterGuideDiscs,
  guideColumnId,
  guideColumns,
  metricValue,
  missingGuideRatings,
  type GuideMetric,
} from "../src/lib/flight-guide";
import type { Disc } from "../src/lib/types";

function disc(overrides: Partial<Disc> = {}): Disc {
  return {
    id: "buzzz-blue",
    apiId: "buzzz",
    name: "Buzzz",
    brand: "Discraft",
    category: "Midrange",
    plastic: "ESP",
    color: "Blue",
    weight: 175,
    speed: 5,
    glide: 4,
    turn: -1,
    fade: 1,
    location: "In Bag",
    locationDetail: "Main bag",
    purchasedAt: null,
    purchasedFrom: "Test shop",
    lostAt: null,
    notes: "",
    photo: null,
    createdAt: "2026-10-06T12:00:00Z",
    updatedAt: "2026-10-06T12:00:00Z",
    ...overrides,
  };
}

test("approximate stability bands have explicit boundaries and do not replace turn or fade", () => {
  const examples: [number, number, string][] = [
    [1, 5, "very-overstable"],
    [0, 3, "very-overstable"],
    [-1, 3.5, "overstable"],
    [-1, 2, "overstable"],
    [-1, 1.5, "neutral"],
    [0, 0, "neutral"],
    [-1, 0.5, "neutral"],
    [-2, 1, "understable"],
    [-3, 0.5, "understable"],
    [-4, 1, "very-understable"],
    [-5, 0, "very-understable"],
  ];
  for (const [turn, fade, expected] of examples) {
    const copy = disc({ turn, fade });
    assert.equal(guideColumnId(copy, "stability"), expected);
    assert.equal(metricValue(copy, "stability"), turn + fade);
    assert.equal(copy.turn, turn);
    assert.equal(copy.fade, fade);
  }
  assert.equal(
    metricValue(disc({ turn: -2, fade: 2 }), "stability"),
    metricValue(disc({ turn: 0, fade: 0 }), "stability"),
  );
});

test("guide axes require only their own ratings, accept zero, and never invent missing or invalid data", () => {
  const incomplete = disc({ glide: null, fade: null });
  assert.deepEqual(missingGuideRatings(incomplete, "stability"), ["fade"]);
  assert.deepEqual(missingGuideRatings(incomplete, "turn"), []);
  assert.equal(metricValue(incomplete, "turn"), -1);
  assert.deepEqual(missingGuideRatings(incomplete, "glide"), ["glide"]);
  assert.equal(metricValue(disc({ turn: 0 }), "turn"), 0);
  assert.equal(metricValue(disc({ fade: 0 }), "fade"), 0);
  assert.equal(metricValue(disc({ glide: 0 }), "glide"), null);
  assert.deepEqual(
    missingGuideRatings(
      disc({ speed: Number.NaN, turn: -6, fade: Number.POSITIVE_INFINITY }),
      "stability",
    ),
    ["speed", "turn", "fade"],
  );
});

test("every physical copy is charted exactly once, shared positions stack, and fractional ratings stay exact", () => {
  const collection = [
    disc(),
    disc({ id: "buzzz-pink", color: "Pink", weight: 169, location: "Storage" }),
    disc({ id: "fractional", speed: 5.5, turn: -0.5, fade: 1.5, glide: 4.5 }),
    disc({ id: "missing", speed: null }),
    disc({ id: "missing-turn", turn: null }),
  ];
  const snapshot = structuredClone(collection);
  const guide = buildFlightGuide(collection, "stability", false);
  assert.deepEqual(guide.speeds, [5.5, 5]);
  assert.deepEqual(
    guide.cells.get("5:neutral")?.map((copy) => copy.id),
    ["buzzz-blue", "buzzz-pink"],
  );
  assert.deepEqual(
    guide.cells.get("5.5:overstable")?.map((copy) => copy.id),
    ["fractional"],
  );
  assert.equal([...guide.cells.values()].flat().length, 3);
  assert.equal(
    new Set([...guide.cells.values()].flat().map((copy) => copy.id)).size,
    3,
  );
  assert.deepEqual(
    guide.unplotted.map((copy) => copy.id),
    ["missing", "missing-turn"],
  );
  assert.deepEqual(collection, snapshot);
  const full = buildFlightGuide(collection, "stability", true);
  assert.equal(full.speeds.length, 16);
  assert.equal(full.speeds[0], 15);
  assert.equal(full.speeds.at(-1), 1);
  assert.ok(full.speeds.includes(5.5));
  for (const metric of ["turn", "fade", "glide"] as GuideMetric[]) {
    const columns = guideColumns(metric, collection);
    const values = columns.map((column) => column.value!);
    assert.deepEqual(
      values,
      [...values].sort((a, b) => b - a),
    );
    assert.ok(values.includes(metricValue(collection[2], metric)!));
    assert.equal(
      guideColumnId(collection[2], metric),
      String(metricValue(collection[2], metric)),
    );
  }
});

test("search and combined location, category, and manufacturer filters preserve distinct physical copies", () => {
  const collection = [
    disc(),
    disc({ id: "pink", color: "Pink", location: "Storage" }),
    disc({ id: "lost", location: "Lost" }),
    disc({
      id: "driver",
      name: "Firebird",
      brand: "Innova",
      category: "Control Driver",
      speed: 9,
    }),
  ];
  const blank = { search: "", location: "", category: "", brand: "" };
  assert.equal(
    filterGuideDiscs(collection, blank).length,
    4,
    "All discs includes lost records",
  );
  assert.deepEqual(
    filterGuideDiscs(collection, {
      ...blank,
      search: "  bUzZz ",
      location: "Storage",
      category: "Midrange",
      brand: "Discraft",
    }).map((copy) => copy.id),
    ["pink"],
  );
  assert.equal(
    filterGuideDiscs(collection, { ...blank, search: "ESP" }).length,
    4,
  );
  assert.equal(
    filterGuideDiscs(collection, { ...blank, search: "green" }).length,
    0,
  );
  assert.equal(filterGuideDiscs(collection, blank)[0].id, "driver");
});

test("interactive guide filters, changes axes and views, previews duplicates, and handles empty collections", async () => {
  const page = new JSDOM('<!doctype html><div id="root"></div>', {
    url: "http://localhost:3000/flight-guide",
  });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: page.window,
    self: page.window,
    document: page.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
  Object.defineProperties(page.window.HTMLDialogElement.prototype, {
    showModal: {
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    },
    close: {
      value: function (this: HTMLDialogElement) {
        this.open = false;
      },
    },
  });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(page.window.document.getElementById("root")!);
  const copies = [
    disc(),
    disc({ id: "pink", color: "Pink", location: "Storage" }),
    disc({ id: "unrated", name: "Unrated", turn: null, glide: 7 }),
  ];
  const document = page.window.document;
  const select = async (label: string, value: string) => {
    const control = Array.from(document.querySelectorAll("label"))
      .find((element) => element.textContent?.startsWith(label))!
      .querySelector("select")!;
    await act(async () => {
      control.value = value;
      control.dispatchEvent(new page.window.Event("change", { bubbles: true }));
    });
  };
  try {
    await act(async () => {
      root.render(createElement(FlightGuideView, { discs: copies }));
    });
    assert.equal(
      document.querySelectorAll(".guide-matrix .guide-disc").length,
      2,
    );
    assert.match(
      document.querySelector(".guide-unplotted")!.textContent!,
      /turn/,
    );
    assert.equal(
      document.querySelectorAll('.guide-matrix th[scope="row"]').length,
      1,
    );
    const pink = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".guide-disc"),
    ).find((button) => button.getAttribute("aria-label")?.includes("Pink"))!;
    assert.doesNotMatch(
      pink.textContent!,
      /Pink/,
      "color belongs in the preview, not the compact card",
    );
    assert.equal(pink.querySelector(".guide-disc-plastic")?.textContent, "ESP");
    assert.equal(
      pink.querySelector(".guide-disc-weight")?.textContent,
      "175 g",
    );
    assert.match(pink.title, /Buzzz.*ESP.*175 g.*Storage/);
    const filterToggle = document.querySelector<HTMLButtonElement>(
      ".guide-filter-toggle",
    )!;
    assert.equal(filterToggle.getAttribute("aria-expanded"), "false");
    assert.equal(filterToggle.getAttribute("aria-controls"), "guide-controls");
    await act(async () => {
      filterToggle.click();
    });
    assert.equal(filterToggle.getAttribute("aria-expanded"), "true");
    assert.ok(
      document.querySelector(".guide-controls")?.classList.contains("is-open"),
    );
    await act(async () => {
      pink.click();
    });
    assert.equal(document.querySelector("dialog")?.open, true);
    assert.match(
      document.querySelector(".guide-preview")!.textContent!,
      /Pink/,
    );
    assert.equal(
      document.querySelector<HTMLAnchorElement>('dialog a[href="/discs/pink"]')
        ?.textContent,
      "Full disc details",
    );
    const back = Array.from(
      document.querySelectorAll<HTMLButtonElement>("dialog button"),
    ).find((button) => button.textContent === "Back to guide")!;
    await act(async () => {
      back.click();
    });
    assert.equal(document.querySelector("dialog"), null);
    await select("Location", "In Bag");
    assert.equal(
      document.querySelectorAll(".guide-matrix .guide-disc").length,
      1,
    );
    await select("Horizontal axis", "glide");
    await act(async () => {
      filterToggle.click();
    });
    assert.equal(filterToggle.getAttribute("aria-expanded"), "false");
    assert.equal(
      document.querySelector<HTMLSelectElement>('select[aria-label="Location"]')
        ?.value,
      "In Bag",
    );
    assert.equal(
      document.querySelector<HTMLSelectElement>(
        'select[aria-label="Horizontal axis"]',
      )?.value,
      "glide",
    );
    assert.equal(
      document.querySelectorAll(".guide-matrix .guide-disc").length,
      2,
      "missing turn doesn't prevent a glide chart",
    );
    assert.equal(document.querySelector(".guide-unplotted"), null);
    const toggle = document.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    )!;
    await act(async () => {
      toggle.click();
    });
    assert.equal(
      document.querySelectorAll('.guide-matrix th[scope="row"]').length,
      15,
    );
    const list = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".guide-view-toggle button"),
    ).find((button) => button.textContent === "List")!;
    await act(async () => {
      list.click();
    });
    assert.equal(document.querySelector("table"), null);
    assert.equal(
      document.querySelectorAll(".guide-list .guide-disc").length,
      2,
    );
    assert.equal(
      document.querySelectorAll(".guide-list h2").length,
      1,
      "list shouldn't repeat empty speed rows",
    );
    await select("Type", "Putter");
    assert.match(
      document.querySelector(".guide-empty")!.textContent!,
      /No discs match/,
    );
    await act(async () => {
      root.render(createElement(FlightGuideView, { discs: [], key: "empty" }));
    });
    assert.match(
      document.querySelector(".guide-empty")!.textContent!,
      /first disc/,
    );
    assert.equal(
      document
        .querySelector<HTMLAnchorElement>(".guide-empty a")
        ?.getAttribute("href"),
      "/",
    );
    await act(async () => {
      root.render(
        createElement(FlightGuideView, {
          discs: [disc({ speed: null, turn: null })],
          key: "unrated",
        }),
      );
    });
    assert.equal(document.querySelector("table"), null);
    assert.equal(document.querySelectorAll(".guide-unplotted li").length, 1);
    assert.match(
      document.querySelector(".guide-unplotted")!.textContent!,
      /speed, turn/,
    );
  } finally {
    await act(async () => {
      root.unmount();
    });
    page.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
