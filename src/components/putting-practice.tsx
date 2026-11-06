"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Disc3, ChartNoAxesCombined, Target } from "lucide-react";
import {
  practicePlan,
  practiceStats,
  type PracticeSession,
} from "@/lib/putting";

export default function PuttingPractice() {
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [editable, setEditable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState(false);
  const [plan, setPlan] = useState([
    { distance: 10, attempts: 30 },
    { distance: 15, attempts: 30 },
    { distance: 20, attempts: 30 },
  ]);
  const [selected, setSelected] = useState<string | null>(null);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const [data, auth] = await Promise.all([
        fetch("/api/putting", { cache: "no-store" }),
        fetch("/api/auth", { cache: "no-store" }),
      ]);
      if (!data.ok || !auth.ok)
        throw new Error("Could not load practice. Please retry.");
      setSessions(await data.json());
      setEditable((await auth.json()).canEdit);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const active = sessions.find((s) => s.id === selected);
  const completed = sessions.filter((s) => s.completedAt);
  const stats = practiceStats(completed);
  const makes = stats.reduce((n, s) => n + s.makes, 0),
    attempts = stats.reduce((n, s) => n + s.attempts, 0);
  const percentage = (m: number, a: number) =>
    a ? `${Math.round((m / a) * 100)}%` : "—";
  async function save(method: "POST" | "PATCH", body: unknown) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/putting", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not save practice.");
      const session = data as PracticeSession;
      setSessions((old) =>
        [session, ...old.filter((s) => s.id !== session.id)].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        ),
      );
      setSelected(session.id);
      setSetup(false);
    } catch (e) {
      setError(
        `${(e as Error).message} Could not confirm the save. Reload saved progress before trying again.`,
      );
    } finally {
      setBusy(false);
    }
  }
  function start() {
    const parsed = practicePlan.safeParse(plan);
    if (!parsed.success) {
      setError(
        "Use 1–30 distances (1–300 feet), 1–500 putts each, and at most 3,000 putts total.",
      );
      return;
    }
    void save("POST", parsed.data);
  }
  function record(result: boolean) {
    if (!active || active.completedAt || busy) return;
    const index = active.rounds.findIndex((r) => r.results.length < r.attempts);
    const rounds = active.rounds.map((r, i) =>
      i === index ? { ...r, results: [...r.results, result] } : r,
    );
    void save("PATCH", { id: active.id, revision: active.revision, rounds });
  }
  function undo() {
    if (!active || busy) return;
    const index = active.rounds.findLastIndex((r) => r.results.length > 0);
    if (index < 0) return;
    void save("PATCH", {
      id: active.id,
      revision: active.revision,
      rounds: active.rounds.map((r, i) =>
        i === index ? { ...r, results: r.results.slice(0, -1) } : r,
      ),
    });
  }
  const current = active?.rounds.find((r) => r.results.length < r.attempts);
  return (
    <div className="app-shell practice-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Disc3 size={26} />
          </span>
          <span>
            disctracker<small>YOUR PERSONAL DISC LOCKER</small>
          </span>
        </Link>
        <p className="nav-label">YOUR LOCKER</p>
        <nav aria-label="Main navigation">
          <Link href="/" className="nav-item">
            <Disc3 size={20} />
            Collection
          </Link>
          <Link href="/flight-guide" className="nav-item">
            <ChartNoAxesCombined size={20} />
            Flight guide
          </Link>
          <Link
            href="/putting-practice"
            className="nav-item active"
            aria-current="page"
          >
            <Target size={20} />
            Putting Practice
          </Link>
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <Link href="/" className="text-button">
            ← Collection
          </Link>
          <span className="workspace-label">PUTTING PRACTICE</span>
        </header>
        <div className="content practice-content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">BUILD YOUR CONFIDENCE</p>
              <h1>Putting Practice</h1>
              <p className="page-description">
                One putt at a time. Track your progress at every distance.
              </p>
            </div>
            {editable && (
              <button
                className="primary"
                disabled={busy || loading}
                onClick={() => {
                  setSetup(true);
                  setSelected(null);
                  setError("");
                }}
              >
                New practice
              </button>
            )}
          </section>
          {error && (
            <div role="alert" className="practice-error">
              <p>{error}</p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void load()}
              >
                Reload saved progress
              </button>
            </div>
          )}
          {loading ? (
            <p role="status">Loading practices…</p>
          ) : (
            <>
              {!editable && (
                <p className="practice-note">
                  Read-only view.{" "}
                  <Link href="/">Sign in as the owner from Collection</Link> to
                  record practice.
                </p>
              )}
              {setup && editable && (
                <section
                  className="practice-panel"
                  aria-label="Configure putting practice"
                >
                  <h2>Build your session</h2>
                  <p>Distances are in feet. Rounds run in the order listed.</p>
                  {plan.map((row, i) => (
                    <div className="practice-plan" key={i}>
                      <label>
                        Distance (feet)
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max="300"
                          value={row.distance || ""}
                          onChange={(e) =>
                            setPlan(
                              plan.map((p, j) =>
                                j === i
                                  ? { ...p, distance: Number(e.target.value) }
                                  : p,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        Putts
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max="500"
                          value={row.attempts || ""}
                          onChange={(e) =>
                            setPlan(
                              plan.map((p, j) =>
                                j === i
                                  ? { ...p, attempts: Number(e.target.value) }
                                  : p,
                              ),
                            )
                          }
                        />
                      </label>
                      <button
                        className="secondary"
                        aria-label={`Remove round ${i + 1}`}
                        disabled={busy || plan.length === 1}
                        onClick={() => setPlan(plan.filter((_, j) => j !== i))}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div className="practice-actions">
                    <button
                      className="secondary"
                      disabled={busy || plan.length >= 30}
                      onClick={() =>
                        setPlan([...plan, { distance: 10, attempts: 10 }])
                      }
                    >
                      Add distance
                    </button>
                    <button className="primary" disabled={busy} onClick={start}>
                      {busy ? "Saving…" : "Start practice"}
                    </button>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => setSetup(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </section>
              )}
              {active && (
                <section
                  className="practice-panel"
                  aria-label="Practice session"
                >
                  <div className="practice-actions">
                    <h2>
                      {active.completedAt
                        ? "Practice complete"
                        : "Practice in progress"}
                    </h2>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => setSelected(null)}
                    >
                      Back to overview
                    </button>
                  </div>
                  {current && (
                    <div className="practice-counter">
                      <p className="eyebrow">{current.distance} FEET</p>
                      <h2>
                        Putt {current.results.length + 1} of {current.attempts}
                      </h2>
                      <p>
                        {current.results.filter(Boolean).length} makes ·{" "}
                        {current.results.filter((r) => !r).length} misses
                      </p>
                      {editable && (
                        <>
                          <div className="practice-score">
                            <button
                              className="primary"
                              disabled={busy}
                              onClick={() => record(true)}
                            >
                              Make ✓
                            </button>
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() => record(false)}
                            >
                              Miss ✕
                            </button>
                          </div>
                          <button
                            className="secondary"
                            disabled={
                              busy ||
                              !active.rounds.some((r) => r.results.length)
                            }
                            onClick={undo}
                          >
                            Undo last putt
                          </button>
                          <p role="status">
                            {busy
                              ? "Saving putt…"
                              : "Progress saved. You can leave and resume later."}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                  <div className="practice-rounds">
                    {active.rounds.map((r, i) => (
                      <div key={i}>
                        <strong>
                          Round {i + 1} · {r.distance} ft
                        </strong>
                        <p>
                          {r.results.filter(Boolean).length}/{r.results.length}{" "}
                          made ·{" "}
                          {percentage(
                            r.results.filter(Boolean).length,
                            r.results.length,
                          )}{" "}
                          · {r.results.length}/{r.attempts} recorded
                        </p>
                        <progress
                          aria-label={`Round ${i + 1} progress`}
                          max={r.attempts}
                          value={r.results.length}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <div className="practice-summary">
                <div>
                  <small>Completed practices</small>
                  <strong>{completed.length}</strong>
                </div>
                <div>
                  <small>Putts made</small>
                  <strong>
                    {makes} / {attempts}
                  </strong>
                </div>
                <div>
                  <small>Make percentage</small>
                  <strong>{percentage(makes, attempts)}</strong>
                </div>
              </div>
              <section className="practice-panel">
                <h2>Performance by distance</h2>
                <p>
                  Completed practices only. In-progress sessions are excluded.
                </p>
                {stats.length ? (
                  <div className="practice-rounds">
                    {stats.map((s) => (
                      <div key={s.distance}>
                        <strong>
                          {s.distance} ft · {percentage(s.makes, s.attempts)}
                        </strong>
                        <p>
                          {s.makes} made / {s.attempts} attempts
                        </p>
                        <progress
                          aria-label={`Make percentage at ${s.distance} feet`}
                          max={s.attempts}
                          value={s.makes}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="practice-note">
                    Finish your first practice to see your stats here.
                  </p>
                )}
              </section>
              <section className="practice-panel">
                <h2>Practice history</h2>
                {!sessions.length && (
                  <p className="practice-note">
                    No practices yet. Start a session to build your putting
                    history.
                  </p>
                )}
                {sessions.map((s) => {
                  const total = s.rounds.reduce(
                      (n, r) => n + r.results.length,
                      0,
                    ),
                    made = s.rounds.reduce(
                      (n, r) => n + r.results.filter(Boolean).length,
                      0,
                    );
                  return (
                    <div className="practice-history" key={s.id}>
                      <div>
                        <strong>
                          {new Date(s.createdAt).toLocaleString()}
                        </strong>
                        <p>
                          {s.completedAt ? "Completed" : "In progress"} · {made}
                          /{total} made · {percentage(made, total)}
                        </p>
                        <small>
                          {s.rounds
                            .map((r) => `${r.attempts} at ${r.distance} ft`)
                            .join(" · ")}
                        </small>
                      </div>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => {
                          setSelected(s.id);
                          setSetup(false);
                          setError("");
                        }}
                      >
                        {s.completedAt
                          ? "View results"
                          : editable
                            ? "Resume"
                            : "View"}
                      </button>
                    </div>
                  );
                })}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
