import type { Disc } from "./types";

export const guideMetrics = {
  stability: {
    label: "Stability · turn + fade",
    description: "More overstable ← → More understable",
  },
  turn: {
    label: "High-speed turn",
    description: "Resists turn ← → More early turn",
  },
  fade: {
    label: "Low-speed fade",
    description: "Stronger finish ← → Straighter finish",
  },
  glide: { label: "Glide", description: "More loft ← → Less loft" },
} as const;
export type GuideMetric = keyof typeof guideMetrics;
export type GuideColumn = {
  id: string;
  label: string;
  range: string;
  tone: number;
  value?: number;
};
export type GuideFilters = {
  search: string;
  location: string;
  category: string;
  brand: string;
};

function validNumber(
  value: number | null,
  min: number,
  max: number,
): value is number {
  return (
    value !== null && Number.isFinite(value) && value >= min && value <= max
  );
}

export function metricValue(disc: Disc, metric: GuideMetric): number | null {
  if (metric === "stability") {
    return validNumber(disc.turn, -5, 1) && validNumber(disc.fade, 0, 5)
      ? disc.turn + disc.fade
      : null;
  }
  const [min, max] =
    metric === "turn" ? [-5, 1] : metric === "fade" ? [0, 5] : [1, 7];
  return validNumber(disc[metric], min, max) ? disc[metric] : null;
}

// DiscTracker's own comparison bands, not an official manufacturer stability rating
// or Marshall Street's curated A–Q placement. Keep turn and fade visible separately.
const stabilityColumns: GuideColumn[] = [
  {
    id: "very-overstable",
    label: "Very overstable",
    range: "Sum ≥ 3",
    tone: 0,
  },
  { id: "overstable", label: "Overstable", range: "1 ≤ sum < 3", tone: 1 },
  { id: "neutral", label: "Neutral", range: "−1 < sum < 1", tone: 2 },
  { id: "understable", label: "Understable", range: "−3 < sum ≤ −1", tone: 3 },
  {
    id: "very-understable",
    label: "Very understable",
    range: "Sum ≤ −3",
    tone: 4,
  },
];

export function guideColumns(
  metric: GuideMetric,
  discs: Disc[],
): GuideColumn[] {
  if (metric === "stability") return stabilityColumns;
  const baseline =
    metric === "turn"
      ? [1, 0, -1, -2, -3, -4, -5]
      : metric === "fade"
        ? [5, 4, 3, 2, 1, 0]
        : [7, 6, 5, 4, 3, 2, 1];
  const values = [
    ...new Set([
      ...baseline,
      ...discs
        .map((disc) => metricValue(disc, metric))
        .filter((value): value is number => value !== null),
    ]),
  ].sort((a, b) => b - a);
  return values.map((value, index) => ({
    id: String(value),
    label: String(value),
    range: metric === "glide" ? "Glide" : metric === "turn" ? "Turn" : "Fade",
    value,
    tone: Math.round((index / (values.length - 1)) * 4),
  }));
}

export function guideColumnId(disc: Disc, metric: GuideMetric): string | null {
  const value = metricValue(disc, metric);
  if (value === null) return null;
  if (metric !== "stability") return String(value);
  return value >= 3
    ? "very-overstable"
    : value >= 1
      ? "overstable"
      : value > -1
        ? "neutral"
        : value > -3
          ? "understable"
          : "very-understable";
}

export function missingGuideRatings(disc: Disc, metric: GuideMetric): string[] {
  const missing: string[] = [];
  if (!validNumber(disc.speed, 1, 15)) missing.push("speed");
  if (metric === "stability") {
    if (!validNumber(disc.turn, -5, 1)) missing.push("turn");
    if (!validNumber(disc.fade, 0, 5)) missing.push("fade");
  } else if (metricValue(disc, metric) === null) missing.push(metric);
  return missing;
}

export function filterGuideDiscs(discs: Disc[], filters: GuideFilters): Disc[] {
  const query = filters.search.trim().toLowerCase();
  return discs
    .filter(
      (disc) =>
        (!filters.location || disc.location === filters.location) &&
        (!filters.category || disc.category === filters.category) &&
        (!filters.brand || disc.brand === filters.brand) &&
        `${disc.name} ${disc.brand} ${disc.plastic} ${disc.color}`
          .toLowerCase()
          .includes(query),
    )
    .sort(
      (a, b) =>
        (b.speed ?? -1) - (a.speed ?? -1) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );
}

export function buildFlightGuide(
  discs: Disc[],
  metric: GuideMetric,
  showEmptySpeeds: boolean,
) {
  const unplotted = discs.filter(
    (disc) => missingGuideRatings(disc, metric).length > 0,
  );
  const plotted = discs.filter(
    (disc) => missingGuideRatings(disc, metric).length === 0,
  );
  const columns = guideColumns(metric, plotted);
  // Preserve fractional ratings rather than rounding discs into another speed row.
  const speeds = [
    ...new Set([
      ...(showEmptySpeeds ? Array.from({ length: 15 }, (_, i) => 15 - i) : []),
      ...plotted.map((disc) => disc.speed!),
    ]),
  ].sort((a, b) => b - a);
  const cells = new Map<string, Disc[]>();
  for (const disc of plotted) {
    const key = `${disc.speed}:${guideColumnId(disc, metric)}`;
    const cell = cells.get(key) ?? [];
    cell.push(disc);
    cells.set(key, cell);
  }
  return { columns, speeds, cells, plotted, unplotted };
}
