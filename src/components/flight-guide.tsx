"use client";

import { Fragment, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChartNoAxesCombined,
  Disc3,
  LayoutGrid,
  List,
  LoaderCircle,
  Search,
  X,
} from "lucide-react";
import { Modal } from "./dashboard";
import { categories, locations, type Disc } from "@/lib/types";
import {
  buildFlightGuide,
  filterGuideDiscs,
  guideColumnId,
  guideMetrics,
  metricValue,
  missingGuideRatings,
  type GuideFilters,
  type GuideMetric,
} from "@/lib/flight-guide";

const emptyFilters: GuideFilters = {
  search: "",
  location: "",
  category: "",
  brand: "",
};
const ratingNames = ["speed", "glide", "turn", "fade"] as const;

function Ratings({ disc }: { disc: Disc }) {
  return (
    <div className="guide-ratings" aria-label="Flight numbers">
      {ratingNames.map((name) => (
        <span key={name} title={name}>
          <small>{name.slice(0, 1).toUpperCase()}</small>
          <strong>{disc[name] ?? "—"}</strong>
        </span>
      ))}
    </div>
  );
}

function DiscTile({
  disc,
  select,
}: {
  disc: Disc;
  select: (disc: Disc) => void;
}) {
  return (
    <button
      className="guide-disc"
      type="button"
      onClick={() => select(disc)}
      aria-label={`View ${disc.name}, ${disc.plastic || "unspecified plastic"}, ${disc.color || "unspecified color"}, ${disc.weight ?? "unknown"} grams, ${disc.location}`}
    >
      <span className="guide-disc-brand">{disc.brand}</span>
      <strong className="guide-disc-name">{disc.name}</strong>
      <span className="guide-disc-copy">
        {[
          disc.plastic,
          disc.color,
          disc.weight !== null ? `${disc.weight} g` : "",
        ]
          .filter(Boolean)
          .join(" · ") || "Physical disc"}
      </span>
      <Ratings disc={disc} />
      <span
        className={`badge ${disc.location.toLowerCase().replace(/\s/g, "-")}`}
      >
        {disc.location}
      </span>
    </button>
  );
}

// Separate the interactive view from fetching so real collection data, empty states,
// filters, and keyboard/touch interactions can all be tested without network mocks.
export function FlightGuideView({ discs }: { discs: Disc[] }) {
  const [filters, setFilters] = useState(emptyFilters);
  const [metric, setMetric] = useState<GuideMetric>("stability");
  const [view, setView] = useState<"chart" | "list">("chart");
  const [showEmptySpeeds, setShowEmptySpeeds] = useState(false);
  const [selected, setSelected] = useState<Disc | null>(null);
  const filtered = filterGuideDiscs(discs, filters);
  const guide = buildFlightGuide(filtered, metric, showEmptySpeeds);
  const activeFilters = Object.values(filters).some(Boolean);
  function filter(key: keyof GuideFilters, value: string) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }
  return (
    <>
      <section className="guide-controls" aria-label="Flight guide filters">
        <label className="guide-search">
          <span>Search your discs</span>
          <div>
            <Search size={18} />
            <input
              type="search"
              aria-label="Search your discs"
              value={filters.search}
              onChange={(event) => filter("search", event.target.value)}
              placeholder="Name, brand, plastic, color…"
            />
          </div>
        </label>
        <label>
          <span>Location</span>
          <select
            aria-label="Location"
            value={filters.location}
            onChange={(event) => filter("location", event.target.value)}
          >
            <option value="">All discs</option>
            {locations.map((location) => (
              <option key={location}>{location}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Type</span>
          <select
            aria-label="Type"
            value={filters.category}
            onChange={(event) => filter("category", event.target.value)}
          >
            <option value="">All types</option>
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Manufacturer</span>
          <select
            aria-label="Manufacturer"
            value={filters.brand}
            onChange={(event) => filter("brand", event.target.value)}
          >
            <option value="">All brands</option>
            {[...new Set(discs.map((disc) => disc.brand))]
              .sort()
              .map((brand) => (
                <option key={brand}>{brand}</option>
              ))}
          </select>
        </label>
        <label className="guide-axis">
          <span>Horizontal axis</span>
          <select
            aria-label="Horizontal axis"
            value={metric}
            onChange={(event) => setMetric(event.target.value as GuideMetric)}
          >
            {Object.entries(guideMetrics).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </section>
      <div className="guide-toolbar">
        <p role="status" aria-live="polite">
          <strong>{guide.plotted.length}</strong> charted · {filtered.length}{" "}
          matching · {discs.length} in collection
        </p>
        <div className="guide-toolbar-actions">
          {activeFilters && (
            <button
              className="text-button"
              onClick={() => setFilters(emptyFilters)}
            >
              <X size={16} />
              Clear filters
            </button>
          )}
          <div className="guide-view-toggle" aria-label="Guide view">
            <button
              type="button"
              aria-pressed={view === "chart"}
              onClick={() => setView("chart")}
            >
              <LayoutGrid size={16} />
              Chart
            </button>
            <button
              type="button"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <List size={16} />
              List
            </button>
          </div>
        </div>
      </div>
      {metric === "stability" && (
        <p className="guide-estimate">
          Approximate stability = turn + fade. Equal sums can describe different
          flights; compare the separate numbers, especially at the same speed.
        </p>
      )}
      {filtered.length === 0 ? (
        <section className="guide-empty">
          <Disc3 size={38} />
          <h2>
            {discs.length
              ? "No discs match these filters"
              : "Your flight guide starts with your first disc"}
          </h2>
          <p>
            {discs.length
              ? "Try another search or clear your filters."
              : "Add discs to your collection and their saved flight numbers will appear here."}
          </p>
          {discs.length ? (
            <button
              className="secondary"
              onClick={() => setFilters(emptyFilters)}
            >
              Clear filters
            </button>
          ) : (
            <Link className="primary" href="/">
              Go to collection
            </Link>
          )}
        </section>
      ) : (
        <>
          {guide.plotted.length > 0 &&
            (view === "chart" ? (
              <section className="guide-chart-panel" aria-label="Flight chart">
                <div className="guide-chart-description">
                  <div>
                    <strong>
                      Speed ×{" "}
                      {metric === "stability"
                        ? "approximate stability"
                        : metric}
                    </strong>
                    <p>{guideMetrics[metric].description}</p>
                  </div>
                  <label className="guide-checkbox">
                    <input
                      type="checkbox"
                      checked={showEmptySpeeds}
                      onChange={(event) =>
                        setShowEmptySpeeds(event.target.checked)
                      }
                    />
                    Show empty speed rows
                  </label>
                </div>
                <p className="guide-scroll-hint">
                  Swipe or scroll sideways to explore the chart. Tap a disc for
                  its details.
                </p>
                <div
                  className="guide-chart-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Scrollable flight chart"
                  aria-describedby="guide-chart-caption"
                >
                  <table
                    className="guide-matrix"
                    style={
                      {
                        "--guide-columns": guide.columns.length,
                      } as CSSProperties
                    }
                  >
                    <caption id="guide-chart-caption" className="guide-sr-only">
                      Your discs by speed, fastest first, and{" "}
                      {guideMetrics[metric].label}. Each card represents one
                      physical disc. Empty cells have no matching discs.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col" className="guide-speed-header">
                          Speed
                        </th>
                        {guide.columns.map((column) => (
                          <th
                            key={column.id}
                            scope="col"
                            data-tone={column.tone}
                          >
                            <strong>{column.label}</strong>
                            <small>{column.range}</small>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {guide.speeds.map((speed) => (
                        <tr key={speed}>
                          <th scope="row" className="guide-speed">
                            <strong>{speed}</strong>
                          </th>
                          {guide.columns.map((column) => (
                            <td key={column.id} data-tone={column.tone}>
                              <div className="guide-cell">
                                {(
                                  guide.cells.get(`${speed}:${column.id}`) ?? []
                                ).map((disc) => (
                                  <DiscTile
                                    key={disc.id}
                                    disc={disc}
                                    select={setSelected}
                                  />
                                ))}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <section className="guide-list" aria-label="Charted disc list">
                {guide.speeds
                  .filter((speed) =>
                    guide.plotted.some((disc) => disc.speed === speed),
                  )
                  .map((speed) => (
                    <Fragment key={speed}>
                      <h2>Speed {speed}</h2>
                      <div className="guide-list-cards">
                        {guide.plotted
                          .filter((disc) => disc.speed === speed)
                          .map((disc) => (
                            <div key={disc.id}>
                              <p>
                                {metric === "stability"
                                  ? guide.columns.find(
                                      (column) =>
                                        column.id ===
                                        guideColumnId(disc, metric),
                                    )?.label
                                  : guideMetrics[metric].label}{" "}
                                · {metricValue(disc, metric)}
                              </p>
                              <DiscTile disc={disc} select={setSelected} />
                            </div>
                          ))}
                      </div>
                    </Fragment>
                  ))}
              </section>
            ))}
          {guide.unplotted.length > 0 && (
            <section
              className="guide-unplotted"
              aria-label="Discs needing flight numbers"
            >
              <h2>
                {guide.unplotted.length}{" "}
                {guide.unplotted.length === 1 ? "disc needs" : "discs need"}{" "}
                ratings for this chart
              </h2>
              <p>
                Nothing is guessed or hidden. Open a disc to review it, then use
                “Full disc details” to edit its flight numbers.
              </p>
              <ul>
                {guide.unplotted.map((disc) => (
                  <li key={disc.id}>
                    <button
                      className="text-button"
                      onClick={() => setSelected(disc)}
                    >
                      {disc.name}{" "}
                      <span>
                        {disc.plastic} · {disc.color} · {disc.location}
                      </span>
                    </button>
                    <small>
                      Missing or invalid:{" "}
                      {missingGuideRatings(disc, metric).join(", ")}
                    </small>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      <details className="guide-method">
        <summary>How to read this guide</summary>
        <div className="guide-number-explanations">
          <p>
            <strong>Speed</strong> compares speed classes and the power needed
            to achieve the intended flight—not a distance in feet. Faster discs
            are higher on the chart.
          </p>
          <p>
            <strong>Glide</strong> describes how well a disc stays aloft. More
            glide is not the same as more stability.
          </p>
          <p>
            <strong>Turn</strong> describes early, high-speed turn. More
            negative numbers mean a greater tendency to turn right on a
            right-hand backhand throw.
          </p>
          <p>
            <strong>Fade</strong> describes the late, slowing finish. Higher
            numbers mean a stronger left finish on a right-hand backhand throw.
            Left-hand backhand and right-hand forehand reverse these directions.
          </p>
        </div>
        <p>
          DiscTracker groups the sum of turn and fade into five comparison
          bands: ≥ 3 very overstable; [1, 3) overstable; (−1, 1) neutral; (−3,
          −1] understable; ≤ −3 very understable. These are our approximate
          bands, not official ratings, Discraft’s separate stability number, or
          Marshall Street’s A–Q positions. “Neutral” does not promise a straight
          flight: −2 turn / 2 fade and 0 turn / 0 fade both sum to zero.
        </p>
        <p>
          Compare similar speeds and preferably the same manufacturer. Brands
          rate differently, and plastic, weight, wear, wind, release angle, and
          throwing power affect real flight. The guide uses your saved ratings
          and does not change them or simulate an exact flight path. Fractional
          ratings retain their own rows and columns; hidden empty rows are
          omitted, not a continuous scale.
        </p>
        <p className="guide-sources">
          Sources:{" "}
          <a
            href="https://www.innovadiscs.com/home/disc-golf-faq/flight-ratings-system/"
            target="_blank"
            rel="noreferrer"
          >
            Innova flight ratings
          </a>{" "}
          ·{" "}
          <a
            href="https://support.discraft.com/support/solutions/articles/44001621475-what-are-these-numbers-on-my-disc-"
            target="_blank"
            rel="noreferrer"
          >
            Discraft flight numbers
          </a>{" "}
          ·{" "}
          <a
            href="https://www.marshallstreetdiscgolf.com/flightguide"
            target="_blank"
            rel="noreferrer"
          >
            Marshall Street chart conventions
          </a>
        </p>
      </details>
      {selected && (
        <Modal title={selected.name} close={() => setSelected(null)} wide>
          <div className="modal-body guide-preview">
            <div className="guide-preview-top">
              {selected.photo ? (
                <img
                  src={`/api/photos/${selected.photo}`}
                  alt={`${selected.color} ${selected.name}`}
                />
              ) : (
                <div className="guide-preview-placeholder">
                  <Disc3 size={64} strokeWidth={1} />
                </div>
              )}
              <div>
                <p className="eyebrow">{selected.brand}</p>
                <h3>{selected.name}</h3>
                <p>{selected.category}</p>
                <Ratings disc={selected} />
                <span
                  className={`badge ${selected.location.toLowerCase().replace(/\s/g, "-")}`}
                >
                  {selected.location}
                </span>
              </div>
            </div>
            <dl>
              {[
                ["Plastic", selected.plastic],
                ["Color", selected.color],
                [
                  "Weight",
                  selected.weight !== null ? `${selected.weight} g` : null,
                ],
                ["Location details", selected.locationDetail],
                [guideMetrics[metric].label, metricValue(selected, metric)],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt>{label}</dt>
                  <dd>{value === "" || value === null ? "—" : value}</dd>
                </div>
              ))}
            </dl>
            {metric === "stability" && (
              <p className="guide-estimate">
                Turn + fade is a comparison shortcut, not an official stability
                rating.
              </p>
            )}
          </div>
          <div className="modal-footer guide-preview-actions">
            <button className="secondary" onClick={() => setSelected(null)}>
              Back to guide
            </button>
            <Link className="primary" href={`/discs/${selected.id}`}>
              Full disc details
            </Link>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function FlightGuide() {
  const [discs, setDiscs] = useState<Disc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/discs", { cache: "no-store", signal: abort.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Could not load your collection. Please try again.");
        return (await response.json()) as Disc[];
      })
      .then(setDiscs)
      .catch((error: Error) => {
        if (!abort.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [attempt]);
  return (
    <div className="app-shell guide-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Disc3 size={26} />
          </span>
          <span>
            disc<span className="brand-light">tracker</span>
            <small>YOUR PERSONAL DISC LOCKER</small>
          </span>
        </Link>
        <p className="nav-label">YOUR LOCKER</p>
        <nav aria-label="Main navigation">
          <Link href="/" className="nav-item">
            <Disc3 size={20} />
            Collection
          </Link>
          <Link
            href="/flight-guide"
            className="nav-item active"
            aria-current="page"
          >
            <ChartNoAxesCombined size={20} />
            Flight guide
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <ChartNoAxesCombined size={24} />
            <p>
              Find your flight.
              <span>See your lineup, spot overlap, and explore your bag.</span>
            </p>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <Link className="text-button" href="/">
            <ArrowLeft size={16} />
            Collection
          </Link>
          <span className="workspace-label">YOUR FLIGHT GUIDE</span>
        </header>
        <div className="content guide-content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">KNOW YOUR LINEUP</p>
              <h1>
                Flight guide <ChartNoAxesCombined size={28} />
              </h1>
              <p className="page-description">
                Your discs. Their numbers. A clearer picture of your bag.
              </p>
            </div>
          </section>
          {loading ? (
            <div className="guide-empty" role="status">
              <LoaderCircle className="spin" />
              Loading your flight guide…
            </div>
          ) : error ? (
            <div className="guide-empty">
              <p className="error" role="alert">
                {error}
              </p>
              <button
                className="secondary"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          ) : (
            <FlightGuideView discs={discs} />
          )}
        </div>
      </main>
    </div>
  );
}
