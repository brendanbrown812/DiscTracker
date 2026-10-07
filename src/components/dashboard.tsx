"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Backpack,
  Boxes,
  CircleHelp,
  Disc3,
  Download,
  Grid2X2,
  List,
  LoaderCircle,
  LogIn,
  LogOut,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
  Pencil,
  CalendarDays,
  Weight,
  ChevronRight,
  Check,
  RotateCcw,
  ImagePlus,
} from "lucide-react";
import {
  categories,
  locations,
  type Disc,
  type DiscEvent,
  type Mold,
} from "@/lib/types";
import type { DiscInput } from "@/lib/validation";

type Auth = { canEdit: boolean; loginAvailable: boolean; local: boolean };
type LocationFilter = "All discs" | (typeof locations)[number];
const locationIcons = {
  "All discs": Disc3,
  "In Bag": Backpack,
  Storage: Boxes,
  Lost: MapPin,
  Other: CircleHelp,
};
const flights = ["speed", "glide", "turn", "fade"] as const;
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateLabel(value: string | null) {
  if (!value) return "—";
  return new Date(
    value.length === 10 ? value + "T12:00:00" : value,
  ).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store" });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "The request could not be completed.");
  return data as T;
}
function FlightNumbers({
  disc,
  labels = false,
}: {
  disc: Pick<Disc, (typeof flights)[number]>;
  labels?: boolean;
}) {
  return (
    <div
      className={`flight-numbers ${labels ? "with-labels" : ""}`}
      aria-label="Flight numbers"
    >
      {flights.map((key) => (
        <div className={key} key={key}>
          {labels && <span>{key}</span>}
          <strong>{disc[key] ?? "—"}</strong>
        </div>
      ))}
    </div>
  );
}
function Photo({ disc }: { disc: Pick<Disc, "photo" | "name" | "color"> }) {
  return disc.photo ? (
    <img
      src={`/api/photos/${disc.photo}`}
      alt={`${disc.color ? disc.color + " " : ""}${disc.name}`}
      loading="lazy"
    />
  ) : (
    <div className="no-photo">
      <Disc3 size={62} strokeWidth={1} />
      <span>No photo yet</span>
    </div>
  );
}
function Badge({ location }: { location: string }) {
  return (
    <span className={`badge ${location.toLowerCase().replace(/\s/g, "-")}`}>
      {location}
    </span>
  );
}

export function Modal({
  title,
  children,
  close,
  wide = false,
  mobileFullScreen = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
  mobileFullScreen?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const el = dialog.current!;
    el.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Mobile keyboards shrink the visual viewport, not always the CSS viewport.
    // Keep the entry sheet above the keyboard without interfering with pinch zoom.
    const viewport = window.visualViewport;
    const updateViewport = () => {
      if (!viewport || viewport.scale !== 1) return;
      el.style.setProperty("--modal-viewport-height", `${viewport.height}px`);
      el.style.setProperty("--modal-viewport-top", `${viewport.offsetTop}px`);
    };
    updateViewport();
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport);
    return () => {
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
      el.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal ${wide ? "wide" : ""} ${mobileFullScreen ? "mobile-fullscreen" : ""}`}
      aria-label={title}
      onCancel={(event) => {
        // A file input emits a bubbling cancel event when its picker is
        // dismissed. Only a cancel on the dialog itself should close it.
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        closeRef.current();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) closeRef.current();
      }}
    >
      <div className="modal-shell">
        <header className="modal-header">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export default function Dashboard({ selectedId }: { selectedId?: string }) {
  const router = useRouter();
  const [discs, setDiscs] = useState<Disc[]>([]);
  const [auth, setAuth] = useState<Auth>({
    canEdit: false,
    loginAvailable: false,
    local: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [location, setLocation] = useState<LocationFilter>("All discs");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [brand, setBrand] = useState("");
  const [plastic, setPlastic] = useState("");
  const [category, setCategory] = useState("");
  const [speed, setSpeed] = useState("");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [editing, setEditing] = useState<Disc | "new" | null>(null);
  const [detail, setDetail] = useState<{
    disc: Disc;
    history: DiscEvent[];
  } | null>(null);
  const [detailError, setDetailError] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Disc | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function reload() {
    const [collection, session] = await Promise.all([
      request<Disc[]>("/api/discs"),
      request<Auth>("/api/auth"),
    ]);
    setDiscs(collection);
    setAuth(session);
    setError("");
  }
  useEffect(() => {
    reload()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError("");
      return;
    }
    let active = true;
    request<{ disc: Disc; history: DiscEvent[] }>(`/api/discs/${selectedId}`)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((e) => {
        if (active) setDetailError(e.message);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const counts = (place: string) =>
    place === "All discs"
      ? discs.length
      : discs.filter((d) => d.location === place).length;
  const activeFilters = !!(brand || plastic || category || speed);
  const visible = discs
    .filter((d) => {
      const text =
        `${d.name} ${d.brand} ${d.plastic} ${d.color} ${d.locationDetail}`.toLowerCase();
      return (
        (location === "All discs" || d.location === location) &&
        text.includes(search.toLowerCase()) &&
        (!brand || d.brand === brand) &&
        (!plastic || d.plastic === plastic) &&
        (!category || d.category === category) &&
        (!speed || d.speed === Number(speed))
      );
    })
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "speed"
          ? (b.speed ?? -1) - (a.speed ?? -1)
          : sort === "oldest"
            ? a.createdAt.localeCompare(b.createdAt)
            : b.createdAt.localeCompare(a.createdAt),
    );
  const clearFilters = () => {
    setSearch("");
    setBrand("");
    setPlastic("");
    setCategory("");
    setSpeed("");
  };
  const closeDetail = () => router.push("/", { scroll: false });
  async function saved() {
    setEditing(null);
    if (selectedId) closeDetail();
    await reload();
    setNotice("Disc saved to your collection.");
  }
  async function destroy() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await request(`/api/discs/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      closeDetail();
      await reload();
      setNotice("Disc removed from your collection.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }
  const unique = (key: "brand" | "plastic") =>
    [...new Set(discs.map((d) => d[key]).filter(Boolean))].sort();
  return (
    <div className="app-shell">
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
        <p className="nav-label">COLLECTION</p>
        <nav aria-label="Collection location">
          {(["All discs", ...locations] as LocationFilter[]).map((place) => {
            const Icon = locationIcons[place];
            return (
              <button
                key={place}
                className={`nav-item ${location === place ? "active" : ""}`}
                onClick={() => {
                  setLocation(place);
                  clearFilters();
                }}
              >
                <Icon size={20} />
                <span>
                  {place === "In Bag"
                    ? "In my bag"
                    : place === "Storage"
                      ? "In storage"
                      : place === "Lost"
                        ? "Lost discs"
                        : place}
                </span>
                <span className="nav-count">{counts(place)}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Backpack size={24} />
            <p>
              Know what you throw.<span>Keep every disc accounted for.</span>
            </p>
          </div>
          <div className="owner-row">
            <span className="avatar">{auth.canEdit ? "ME" : "DG"}</span>
            <div>
              <strong>
                {auth.canEdit ? "My disc locker" : "Disc collection"}
              </strong>
              <small>
                {auth.local
                  ? "Local workspace"
                  : auth.canEdit
                    ? "Owner access"
                    : "Read-only view"}
              </small>
            </div>
            {auth.canEdit && !auth.local ? (
              <button
                className="icon-button"
                title="Sign out"
                aria-label="Sign out"
                onClick={async () => {
                  await request("/api/auth", { method: "DELETE" });
                  await reload();
                }}
              >
                <LogOut size={18} />
              </button>
            ) : auth.loginAvailable ? (
              <button
                className="icon-button"
                aria-label="Owner sign in"
                onClick={() => setLoginOpen(true)}
              >
                <LogIn size={18} />
              </button>
            ) : null}
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            My locker <ChevronRight size={15} />
            <span>{location}</span>
          </div>
          <div className="topbar-actions">
            {auth.canEdit && (
              <a className="text-button export" href="/api/export">
                <Download size={16} />
                Export collection
              </a>
            )}
            <span className="workspace-label">
              {auth.local ? "LOCAL WORKSPACE" : "DISC GOLF COLLECTION"}
            </span>
          </div>
        </header>
        <div className="content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">EVERY DISC HAS A STORY</p>
              <h1>
                {location === "All discs"
                  ? "Your collection"
                  : location === "In Bag"
                    ? "In your bag"
                    : location === "Storage"
                      ? "In storage"
                      : location === "Lost"
                        ? "Lost discs"
                        : "Other locations"}
                <span className="heading-count">{counts(location)}</span>
              </h1>
              <p className="page-description">
                {location === "Lost"
                  ? "Gone for now. Keep the details for when they find their way back."
                  : "Your favorites, your backups, and everything in between."}
              </p>
            </div>
            {auth.canEdit && (
              <button className="primary" onClick={() => setEditing("new")}>
                <Plus size={19} />
                Add disc
              </button>
            )}
          </section>
          <section className="stats" aria-label="Collection overview">
            {[
              {
                label: "Total discs",
                value: discs.length,
                icon: Disc3,
                place: "All discs",
                sub: "In your collection",
              },
              {
                label: "In my bag",
                value: counts("In Bag"),
                icon: Backpack,
                place: "In Bag",
                sub: "Ready for the next round",
              },
              {
                label: "In storage",
                value: counts("Storage"),
                icon: Boxes,
                place: "Storage",
                sub: "Waiting for their turn",
              },
              {
                label: "Lost discs",
                value: counts("Lost"),
                icon: MapPin,
                place: "Lost",
                sub: "Hopefully not for long",
              },
            ].map(({ label, value, icon: Icon, place, sub }) => (
              <button
                key={label}
                className={`stat-card ${place === "Lost" ? "lost-stat" : ""}`}
                onClick={() => {
                  setLocation(place as LocationFilter);
                  clearFilters();
                }}
              >
                <div className="stat-top">
                  <span>{label}</span>
                  <Icon size={19} />
                </div>
                <strong>{value}</strong>
                <small>{sub}</small>
              </button>
            ))}
          </section>
          <section className="collection-surface" aria-label="Disc collection">
            <div className="collection-heading">
              <h2>
                {location === "All discs" ? "All discs" : location}
                <span>{visible.length}</span>
              </h2>
              <div className="view-toggle" aria-label="View mode">
                <button
                  aria-label="Grid view"
                  aria-pressed={view === "grid"}
                  className={view === "grid" ? "selected" : ""}
                  onClick={() => setView("grid")}
                >
                  <Grid2X2 size={18} />
                </button>
                <button
                  aria-label="List view"
                  aria-pressed={view === "list"}
                  className={view === "list" ? "selected" : ""}
                  onClick={() => setView("list")}
                >
                  <List size={19} />
                </button>
              </div>
            </div>
            <div className="toolbar">
              <label className="search">
                <Search size={18} />
                <input
                  aria-label="Search collection"
                  placeholder="Search name, plastic, color…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    aria-label="Clear search"
                    onClick={() => setSearch("")}
                  >
                    <X size={16} />
                  </button>
                )}
              </label>
              <button
                className={`secondary ${activeFilters ? "filter-active" : ""}`}
                aria-expanded={showFilters}
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal size={17} />
                Filters{activeFilters && <span className="filter-indicator" />}
              </button>
              <select
                aria-label="Sort discs"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name">Name A–Z</option>
                <option value="speed">Speed: high to low</option>
              </select>
            </div>
            {showFilters && (
              <div className="filter-panel">
                <label>
                  Manufacturer
                  <select
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                  >
                    <option value="">All manufacturers</option>
                    {unique("brand").map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Plastic
                  <select
                    value={plastic}
                    onChange={(e) => setPlastic(e.target.value)}
                  >
                    <option value="">All plastics</option>
                    {unique("plastic").map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Type
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">All types</option>
                    {categories.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Speed
                  <select
                    value={speed}
                    onChange={(e) => setSpeed(e.target.value)}
                  >
                    <option value="">Any speed</option>
                    {Array.from({ length: 15 }, (_, i) => i + 1).map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                {activeFilters && (
                  <button className="text-button" onClick={clearFilters}>
                    Clear filters
                  </button>
                )}
              </div>
            )}
            {error && (
              <div className="error" role="alert">
                {error}
                <button
                  className="text-button"
                  onClick={() => reload().catch((e) => setError(e.message))}
                >
                  Try again
                </button>
              </div>
            )}
            {loading ? (
              <div className="empty">
                <LoaderCircle className="spin" size={30} />
                <p>Opening your locker…</p>
              </div>
            ) : visible.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">
                  <Disc3 size={48} strokeWidth={1.2} />
                </div>
                <h3>
                  {discs.length === 0
                    ? "Your collection starts here"
                    : "No discs here yet"}
                </h3>
                <p>
                  {discs.length === 0
                    ? "Add your first disc. We’ll help fill in the flight numbers."
                    : search || activeFilters
                      ? "Try a different search or clear your filters."
                      : `Discs in ${location.toLowerCase()} will appear here.`}
                </p>
                {search || activeFilters ? (
                  <button className="secondary" onClick={clearFilters}>
                    Clear filters
                  </button>
                ) : auth.canEdit ? (
                  <button className="primary" onClick={() => setEditing("new")}>
                    <Plus size={18} />
                    Add your first disc
                  </button>
                ) : null}
              </div>
            ) : view === "grid" ? (
              <div className="disc-grid">
                {visible.map((disc) => (
                  <Link
                    href={`/discs/${disc.id}`}
                    key={disc.id}
                    className="disc-card"
                    scroll={false}
                  >
                    <div className="disc-photo">
                      <Photo disc={disc} />
                      <Badge location={disc.location} />
                    </div>
                    <div className="card-body">
                      <div className="card-kicker">
                        <span>{disc.brand}</span>
                        <span>
                          {disc.weight ? `${disc.weight} g` : "Weight unknown"}
                        </span>
                      </div>
                      <h3>{disc.name}</h3>
                      <p className="card-description">
                        {[disc.plastic, disc.color]
                          .filter(Boolean)
                          .join(" · ") || "Add plastic & color"}
                      </p>
                      <FlightNumbers disc={disc} labels />
                      <div className="card-footer">
                        <span>{disc.category}</span>
                        <span>
                          View disc <ChevronRight size={14} />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Disc</th>
                      <th>Plastic / color</th>
                      <th>Weight</th>
                      <th>Flight numbers</th>
                      <th>Location</th>
                      <th>Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((disc) => (
                      <tr key={disc.id}>
                        <td>
                          <Link
                            href={`/discs/${disc.id}`}
                            className="table-disc"
                          >
                            <div className="table-photo">
                              <Photo disc={disc} />
                            </div>
                            <div>
                              <strong>{disc.name}</strong>
                              <small>{disc.brand}</small>
                            </div>
                          </Link>
                        </td>
                        <td>
                          {disc.plastic || "—"}
                          <small>{disc.color || "—"}</small>
                        </td>
                        <td>{disc.weight ? `${disc.weight} g` : "—"}</td>
                        <td>
                          <FlightNumbers disc={disc} />
                        </td>
                        <td>
                          <Badge location={disc.location} />
                        </td>
                        <td>{dateLabel(disc.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <footer className="page-footer">
            <span>
              {visible.length} of {discs.length} discs
            </span>
            <span>Made for the next round.</span>
          </footer>
        </div>
      </main>
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {editing && (
        <DiscForm
          disc={editing === "new" ? null : editing}
          close={() => setEditing(null)}
          saved={saved}
        />
      )}
      {selectedId && !editing && !deleteTarget && (
        <Modal
          title={detail?.disc.name || "Disc details"}
          close={closeDetail}
          wide
        >
          {detailError ? (
            <div className="modal-body">
              <p className="error" role="alert">
                {detailError}
              </p>
              <button className="secondary" onClick={closeDetail}>
                Back to collection
              </button>
            </div>
          ) : !detail ? (
            <div className="empty">
              <LoaderCircle className="spin" />
              Loading disc…
            </div>
          ) : (
            <DiscDetails
              data={detail}
              canEdit={auth.canEdit}
              edit={() => setEditing(detail.disc)}
              remove={() => setDeleteTarget(detail.disc)}
              changeLocation={() =>
                setEditing({
                  ...detail.disc,
                  location: detail.disc.location === "Lost" ? "In Bag" : "Lost",
                  lostAt: detail.disc.location === "Lost" ? null : today(),
                })
              }
            />
          )}
        </Modal>
      )}
      {loginOpen && (
        <Login
          close={() => setLoginOpen(false)}
          loggedIn={async () => {
            setLoginOpen(false);
            await reload();
            setNotice("Signed in. Your locker is ready to edit.");
          }}
        />
      )}
      {deleteTarget && (
        <Modal
          title="Remove this disc?"
          close={() => !deleting && setDeleteTarget(null)}
        >
          <div className="modal-body">
            <p>
              Remove <strong>{deleteTarget.name}</strong> from your collection?
              Its photo and location history will also be removed. This cannot
              be undone.
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="modal-footer">
            <button
              className="secondary"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Keep disc
            </button>
            <button className="danger" disabled={deleting} onClick={destroy}>
              {deleting ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Trash2 size={18} />
              )}
              Remove disc
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DiscDetails({
  data: { disc, history },
  canEdit,
  edit,
  remove,
  changeLocation,
}: {
  data: { disc: Disc; history: DiscEvent[] };
  canEdit: boolean;
  edit: () => void;
  remove: () => void;
  changeLocation: () => void;
}) {
  return (
    <>
      <div className="modal-body detail-body">
        <div className="detail-top">
          <div className="detail-photo">
            <Photo disc={disc} />
          </div>
          <div className="detail-summary">
            <span className="eyebrow">{disc.brand}</span>
            <h3>{disc.name}</h3>
            <p>{disc.category}</p>
            <Badge location={disc.location} />
            <FlightNumbers disc={disc} labels />
          </div>
        </div>
        <div className="detail-fields">
          {[
            ["Plastic", disc.plastic],
            ["Color", disc.color],
            ["Weight", disc.weight ? `${disc.weight} g` : null],
            ["Location details", disc.locationDetail],
            ["Added to collection", dateLabel(disc.createdAt)],
            [
              "Purchase date",
              disc.purchasedAt ? dateLabel(disc.purchasedAt) : null,
            ],
            ["Purchased from", disc.purchasedFrom],
            ...(disc.location === "Lost"
              ? [["Date lost", dateLabel(disc.lostAt)]]
              : []),
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value || "—"}</strong>
            </div>
          ))}
        </div>
        {disc.notes && (
          <section className="detail-notes">
            <h4>Notes</h4>
            <p>{disc.notes}</p>
          </section>
        )}
        <section className="history">
          <h4>Location history</h4>
          {history.map((event) => (
            <div className="history-item" key={event.id}>
              <span className="history-dot" />
              <div>
                <strong>
                  {event.kind} · {event.location}
                </strong>
                {event.detail && <p>{event.detail}</p>}
                {event.lostAt && <p>Lost {dateLabel(event.lostAt)}</p>}
                <small>{dateLabel(event.createdAt)}</small>
              </div>
            </div>
          ))}
        </section>
      </div>
      {canEdit && (
        <div className="modal-footer detail-actions">
          <button className="text-button delete-link" onClick={remove}>
            <Trash2 size={16} />
            Remove
          </button>
          <div>
            <button className="secondary" onClick={changeLocation}>
              {disc.location === "Lost" ? (
                <RotateCcw size={17} />
              ) : (
                <MapPin size={17} />
              )}
              {disc.location === "Lost" ? "Mark recovered" : "Mark lost"}
            </button>
            <button className="primary" onClick={edit}>
              <Pencil size={17} />
              Edit disc
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const blank: DiscInput = {
  apiId: null,
  name: "",
  brand: "",
  category: "Other",
  plastic: "",
  color: "",
  weight: null,
  speed: null,
  glide: null,
  turn: null,
  fade: null,
  location: "In Bag",
  locationDetail: "",
  purchasedAt: null,
  purchasedFrom: "",
  lostAt: null,
  notes: "",
};
function DiscForm({
  disc,
  close,
  saved,
}: {
  disc: Disc | null;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [form, setForm] = useState<DiscInput>(
    disc
      ? {
          ...disc,
          location: disc.location as DiscInput["location"],
          category: disc.category as DiscInput["category"],
        }
      : blank,
  );
  const [query, setQuery] = useState("");
  const [molds, setMolds] = useState<Mold[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [manual, setManual] = useState(!!disc);
  const [lookupDone, setLookupDone] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (query.trim().length < 2 || manual) {
      setMolds([]);
      setCatalogLoading(false);
      setLookupDone(false);
      return;
    }
    const abort = new AbortController();
    setCatalogLoading(true);
    setCatalogError("");
    setLookupDone(false);
    const timer = setTimeout(() => {
      request<{ molds: Mold[]; cached: boolean }>(
        `/api/catalog?q=${encodeURIComponent(query)}`,
        { signal: abort.signal },
      )
        .then((data) => {
          setMolds(data.molds);
          setStale(data.cached);
          setLookupDone(true);
        })
        .catch((e) => {
          if (e.name !== "AbortError") {
            setCatalogError(e.message);
            setMolds([]);
          }
        })
        .finally(() => {
          if (!abort.signal.aborted) setCatalogLoading(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [query, manual]);
  function field<K extends keyof DiscInput>(key: K, value: DiscInput[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }
  function selectMold(mold: Mold) {
    setForm((previous) => ({
      ...previous,
      apiId: mold.id,
      name: mold.name,
      brand: mold.brand,
      category: categories.includes(mold.category as DiscInput["category"])
        ? (mold.category as DiscInput["category"])
        : "Other",
      speed: mold.speed,
      glide: mold.glide,
      turn: mold.turn,
      fade: mold.fade,
    }));
    setManual(true);
    setQuery("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set(
        "data",
        JSON.stringify({
          ...form,
          lostAt: form.location === "Lost" ? form.lostAt || today() : null,
        }),
      );
      body.set("removePhoto", String(removePhoto));
      if (file) body.set("photo", file);
      await request(disc ? `/api/discs/${disc.id}` : "/api/discs", {
        method: disc ? "PUT" : "POST",
        body,
      });
      await saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const photo =
    preview ||
    (!removePhoto && disc?.photo ? `/api/photos/${disc.photo}` : null);
  return (
    <Modal
      title={disc ? "Edit disc" : "Add a disc"}
      close={() => !busy && close()}
      wide
      mobileFullScreen
    >
      <form onSubmit={submit}>
        <div className="modal-body form-body">
          <section className="form-section">
            <div className="section-title">
              <span>01</span>
              <h3>The disc</h3>
            </div>
            {!manual ? (
              <>
                <div className="field">
                  <label htmlFor="catalog-query">Find your disc</label>
                  <div className="search catalog-search">
                    <Search size={18} />
                    <input
                      id="catalog-query"
                      aria-label="Find disc in DiscIt"
                      placeholder="Try Buzzz, Destroyer, Aviar…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {catalogLoading && (
                      <LoaderCircle size={18} className="spin" />
                    )}
                  </div>
                </div>
                <p className="field-hint">
                  Search a mold to fill in its manufacturer and flight numbers.
                </p>
                {catalogError && (
                  <p className="error" role="alert">
                    {catalogError}
                  </p>
                )}
                {stale && molds.length > 0 && (
                  <p className="field-hint">
                    Showing saved catalog results while DiscIt is unavailable.
                  </p>
                )}
                {molds.length > 0 && (
                  <div className="catalog-results">
                    {molds.map((mold) => (
                      <button
                        type="button"
                        key={mold.id}
                        onClick={() => selectMold(mold)}
                      >
                        <div>
                          <strong>{mold.name}</strong>
                          <span>
                            {mold.brand} · {mold.category}
                          </span>
                        </div>
                        <FlightNumbers disc={mold} />
                        <Plus size={17} />
                      </button>
                    ))}
                  </div>
                )}
                {lookupDone && !catalogLoading && molds.length === 0 && (
                  <p className="field-hint">
                    No matches. Try a shorter name, or enter your disc manually.
                  </p>
                )}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setManual(true);
                    field("name", query.trim());
                  }}
                >
                  Enter disc manually
                </button>
              </>
            ) : (
              <>
                {form.apiId && (
                  <div className="catalog-selected">
                    <Check size={17} />
                    <span>Flight numbers filled from DiscIt</span>
                  </div>
                )}
                <div className="form-grid">
                  <label className="field">
                    Name
                    <input
                      required
                      maxLength={100}
                      value={form.name}
                      onChange={(e) => {
                        field("name", e.target.value);
                        field("apiId", null);
                      }}
                      placeholder="Disc mold name"
                    />
                  </label>
                  <label className="field">
                    Manufacturer
                    <input
                      required
                      maxLength={100}
                      value={form.brand}
                      onChange={(e) => {
                        field("brand", e.target.value);
                        field("apiId", null);
                      }}
                      placeholder="e.g. Innova"
                    />
                  </label>
                </div>
                <div className="form-grid">
                  <label className="field">
                    Type
                    <select
                      value={form.category}
                      onChange={(e) =>
                        field(
                          "category",
                          e.target.value as DiscInput["category"],
                        )
                      }
                    >
                      {categories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <div className="lookup-again">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setManual(false)}
                    >
                      <Search size={16} />
                      Search disc catalog
                    </button>
                  </div>
                </div>
                <div className="flight-fields">
                  {flights.map((key, i) => (
                    <label key={key} className={`field ${key}`}>
                      {key}
                      <input
                        type="number"
                        step="0.5"
                        min={[1, 1, -5, 0][i]}
                        max={[15, 7, 1, 5][i]}
                        value={form[key] ?? ""}
                        onChange={(e) =>
                          field(
                            key,
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                          )
                        }
                        placeholder="—"
                      />
                    </label>
                  ))}
                </div>
                <p className="field-hint">
                  Flight numbers are saved with this disc. You can adjust them
                  here.
                </p>
              </>
            )}
          </section>
          <section className="form-section">
            <div className="section-title">
              <span>02</span>
              <h3>Your disc</h3>
            </div>
            <div className="physical-grid">
              <div className="photo-upload">
                {photo ? (
                  <div className="upload-preview">
                    <img src={photo} alt="Disc photo preview" />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Remove photo"
                      onClick={() => {
                        setFile(null);
                        setRemovePhoto(true);
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <ImagePlus size={32} strokeWidth={1.3} />
                )}
                <label className="photo-picker">
                  <Upload size={16} />
                  {photo ? "Change photo" : "Upload photo"}
                  <input
                    type="file"
                    aria-label="Upload disc photo"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif"
                    onChange={(e) => {
                      const chosen = e.target.files?.[0];
                      if (!chosen) return;
                      if (chosen.size > 10 * 1024 * 1024) {
                        setError("Photos must be smaller than 10 MB.");
                        return;
                      }
                      setFile(chosen);
                      setRemovePhoto(false);
                      setError("");
                    }}
                  />
                </label>
                <small>Up to 10 MB</small>
              </div>
              <div>
                <div className="form-grid">
                  <label className="field">
                    Plastic
                    <input
                      maxLength={100}
                      placeholder="e.g. Star, Champion"
                      value={form.plastic}
                      onChange={(e) => field("plastic", e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Color
                    <input
                      maxLength={100}
                      placeholder="e.g. Blue, pink swirl"
                      value={form.color}
                      onChange={(e) => field("color", e.target.value)}
                    />
                  </label>
                </div>
                <label className="field weight-field">
                  Weight (grams)
                  <div className="input-icon">
                    <Weight size={16} />
                    <input
                      type="number"
                      min="1"
                      max="300"
                      step="0.1"
                      inputMode="decimal"
                      placeholder="175"
                      value={form.weight ?? ""}
                      onChange={(e) =>
                        field(
                          "weight",
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    />
                  </div>
                </label>
              </div>
            </div>
          </section>
          <section className="form-section">
            <div className="section-title">
              <span>03</span>
              <h3>Where it lives</h3>
            </div>
            <div className="location-options">
              {locations.map((place) => {
                const Icon = locationIcons[place];
                return (
                  <button
                    type="button"
                    key={place}
                    aria-pressed={form.location === place}
                    className={form.location === place ? "selected" : ""}
                    onClick={() => {
                      field("location", place);
                      field(
                        "lostAt",
                        place === "Lost" ? form.lostAt || today() : null,
                      );
                    }}
                  >
                    <Icon size={19} />
                    {place}
                  </button>
                );
              })}
            </div>
            <div className="form-grid">
              <label className="field">
                Location details
                <input
                  maxLength={200}
                  placeholder={
                    form.location === "Lost"
                      ? "Course, hole, or last known spot"
                      : "Bag name, shelf, or storage bin"
                  }
                  value={form.locationDetail}
                  onChange={(e) => field("locationDetail", e.target.value)}
                />
              </label>
              {form.location === "Lost" && (
                <label className="field">
                  Date lost
                  <input
                    type="date"
                    required
                    value={form.lostAt || today()}
                    onChange={(e) => field("lostAt", e.target.value || null)}
                  />
                </label>
              )}
            </div>
          </section>
          <section className="form-section">
            <div className="section-title">
              <span>04</span>
              <h3>Purchase & notes</h3>
              <small>Optional</small>
            </div>
            <div className="form-grid">
              <label className="field">
                Purchased from
                <input
                  maxLength={200}
                  placeholder="Store, website, or person"
                  value={form.purchasedFrom}
                  onChange={(e) => field("purchasedFrom", e.target.value)}
                />
              </label>
              <label className="field">
                Purchase date
                <input
                  type="date"
                  value={form.purchasedAt || ""}
                  onChange={(e) => field("purchasedAt", e.target.value || null)}
                />
              </label>
            </div>
            <label className="field">
              Notes
              <textarea
                maxLength={3000}
                rows={3}
                placeholder="How it flies, favorite shots, or anything worth remembering…"
                value={form.notes}
                onChange={(e) => field("notes", e.target.value)}
              />
            </label>
            <p className="field-hint">
              <CalendarDays size={14} />
              Added date is recorded automatically.
            </p>
          </section>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={close}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="primary"
            disabled={busy || !form.name.trim() || !form.brand.trim()}
          >
            {busy ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <Check size={18} />
            )}
            {busy ? "Saving…" : disc ? "Save changes" : "Add to collection"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Login({
  close,
  loggedIn,
}: {
  close: () => void;
  loggedIn: () => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      await loggedIn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Owner sign in" close={() => !busy && close()}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <p className="login-description">
            Sign in to add discs and manage your collection.
          </p>
          <label className="field">
            Password
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={close}
          >
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy && <LoaderCircle className="spin" size={17} />}Sign in
          </button>
        </div>
      </form>
    </Modal>
  );
}
