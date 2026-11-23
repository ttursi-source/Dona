import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
  type ReactNode,
} from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ChevronRight, LogOut, Moon, Search, Sun, X } from "lucide-react";
import { DemoBanner } from "@/components/dona/DemoBanner";
import {
  dashboardStyles,
  formatCount,
  type CountFormat,
} from "@/components/ui/glassy-dashboard";
import { syncNow, useSyncStatus } from "@/lib/sync";

export interface WorkspaceViewDef<T extends string = string> {
  id: T;
  label: string;
  short: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  description: string;
  prompt: string;
}

const donaWorkspaceStyles = `
.gd-dock button {
  z-index: 1;
  position: relative;
  display: flex;
  gap: 6px;
  justify-content: center;
  align-items: center;
  min-inline-size: 44px;
  min-block-size: 44px;
  padding: 0 13px;
  border-radius: 999px;
  border: 0;
  background: transparent;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}
.gd-dock-side button { padding: 0; }
.gd-dock button svg { width: 16px; height: 16px; stroke-width: 1.9; }
.gd-dock button[aria-current="page"] { color: var(--gd-pick-ink); }
.gd-dock button:not([aria-current="page"]):hover { background: var(--gd-inner); }
.gd-dock-side button:is(:hover, :focus-visible) .gd-dock-tip { display: inline; }
@media (max-width: 760px) {
  .gd-dock-bottom button {
    flex: 1;
    flex-direction: column;
    gap: 2px;
    padding: 3px 5px;
    min-block-size: 47px;
    line-height: 1.2;
    font-size: 9.5px;
  }
  .gd-dock-bottom button svg { width: 15px; height: 15px; }
}
@media (forced-colors: active) {
  .gd-dock button[aria-current="page"] { border: 2px solid Highlight; }
}

.gd-top {
  grid-template-columns: minmax(150px, 1fr) minmax(140px, 250px) auto;
}
.gd-brand > div {
  min-inline-size: 0;
}
.gd-brand strong,
.gd-brand small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gd-ask {
  inline-size: 100%;
  min-inline-size: 0;
}
.gd-top-actions {
  align-items: center;
  flex-shrink: 0;
}

.dn-exit-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-block-size: 44px;
  padding: 0 13px;
  border-radius: 999px;
  border: 1px solid var(--gd-line);
  background: var(--gd-inner);
  font-size: 11.5px;
  font-weight: 780;
  white-space: nowrap;
  flex-shrink: 0;
}
.dn-exit-btn:hover { background: var(--gd-raised); }
.dn-exit-btn svg { width: 15px; height: 15px; }

.dn-sync-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-block-size: 40px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--gd-line);
  background: var(--gd-inner);
  font-size: 12px;
  font-weight: 760;
  color: var(--gd-ink);
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
}
.dn-sync-pill:hover { background: var(--gd-raised); }
.dn-sync-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
}

@media (max-width: 760px) {
  .gd-top {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .dn-exit-btn {
    min-block-size: 41px;
    padding: 0 10px;
    font-size: 11.5px;
  }
  .dn-sync-pill {
    min-block-size: 41px;
    padding: 0 10px;
  }
}
@media (max-width: 540px) {
  .dn-exit-btn-salir,
  .dn-sync-pill {
    min-inline-size: 41px;
    padding: 0;
    justify-content: center;
  }
  .dn-exit-btn-salir .dn-exit-label,
  .dn-sync-label {
    display: none;
  }
}

.dn-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.dn-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 860px) {
  .dn-grid-2, .dn-grid-3 { grid-template-columns: minmax(0, 1fr); }
}

.dn-field { display: grid; gap: 6px; }
.dn-field label, .dn-label {
  font-size: 11px;
  font-weight: 780;
  color: var(--gd-muted);
}
.dn-input, .dn-select, .dn-textarea {
  width: 100%;
  border: 1px solid var(--gd-line);
  border-radius: 12px;
  background: var(--gd-inner);
  padding: 9px 12px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--gd-ink);
  min-block-size: 40px;
}
.dn-select option {
  color: var(--gd-ink);
  background: var(--gd-surface);
}
.dn-textarea { min-block-size: 74px; resize: vertical; }
.dn-input:focus, .dn-select:focus, .dn-textarea:focus {
  outline: 2px solid var(--gd-focus);
  outline-offset: 1px;
}

.dn-seg {
  display: inline-flex;
  padding: 3px;
  border-radius: 999px;
  border: 1px solid var(--gd-rim);
  background: var(--gd-inner);
  gap: 3px;
}
.dn-seg button {
  border: 0;
  border-radius: 999px;
  padding: 7px 14px;
  font-size: 11.5px;
  font-weight: 780;
  background: transparent;
  min-block-size: 36px;
}
.dn-seg button[aria-pressed="true"] {
  background: var(--gd-primary);
  color: var(--gd-primary-ink);
}

.dn-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--gd-line);
  background: var(--gd-inner);
  font-size: 11px;
  font-weight: 740;
}
.dn-chip-btn:hover { background: var(--gd-raised); }
.dn-chip-active {
  background: var(--gd-primary);
  color: var(--gd-primary-ink);
  border-color: transparent;
}

.dn-stepper {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--gd-line);
  border-radius: 12px;
  background: var(--gd-inner);
  overflow: hidden;
  min-block-size: 40px;
}
.dn-stepper button {
  border: 0;
  background: transparent;
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  font-weight: 800;
}
.dn-stepper button:hover { background: var(--gd-raised); }
.dn-stepper input {
  width: 56px;
  text-align: center;
  border: 0;
  background: transparent;
  font-weight: 800;
  font-size: 13px;
}

.dn-capture-drop {
  display: grid;
  place-items: center;
  text-align: center;
  gap: 10px;
  padding: 24px 16px;
  border-radius: 20px;
  border: 1.5px dashed var(--gd-rim);
  background: var(--gd-inner);
}
.dn-thumb {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  object-fit: cover;
  border: 1px solid var(--gd-line);
  background: var(--gd-inner);
}
.dn-alert-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 13px;
  border-radius: 14px;
  border: 1px solid var(--gd-line);
  background: var(--gd-inner);
}
.dn-alert-card[data-severity="alta"] {
  border-color: color-mix(in srgb, var(--gd-coral) 45%, transparent);
  background: color-mix(in srgb, var(--gd-coral) 10%, var(--gd-inner));
}
`;

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    update();
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

gsap.registerPlugin(useGSAP);

function GenericDock<T extends string>({
  views,
  active,
  side = false,
  onSelect,
}: {
  views: readonly WorkspaceViewDef<T>[];
  active: T;
  side?: boolean;
  onSelect: (id: T) => void;
}) {
  const nav = useRef<HTMLElement>(null);
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = nav.current;
    const indicator = marker.current;
    if (!container || !indicator) return;
    const adjust = () => {
      const current = container.querySelector<HTMLElement>('[aria-current="page"]');
      if (!current) return;
      indicator.style.width = `${current.offsetWidth}px`;
      indicator.style.height = `${current.offsetHeight}px`;
      indicator.style.transform = `translate(${current.offsetLeft}px, ${current.offsetTop}px)`;
      indicator.dataset.ready = "true";
    };
    const observer = new ResizeObserver(adjust);
    observer.observe(container);
    container.querySelectorAll("button").forEach((btn) => observer.observe(btn));
    adjust();
    return () => observer.disconnect();
  }, [active, views]);

  return (
    <nav
      ref={nav}
      className={side ? "gd-dock gd-dock-side" : "gd-dock gd-dock-bottom"}
      aria-label={side ? "Accesos rápidos" : "Vistas del panel"}
    >
      <span ref={marker} className="gd-dock-indicator" aria-hidden="true" />
      {views.map(({ id, label, short, icon: Icon }) => (
        <button
          type="button"
          key={id}
          aria-label={label}
          aria-current={active === id ? "page" : undefined}
          onClick={() => onSelect(id)}
        >
          <Icon aria-hidden={true} />
          <span className="gd-dock-text" aria-hidden="true">
            {label}
          </span>
          <span className="gd-dock-short" aria-hidden="true">
            {short}
          </span>
          {side && (
            <span className="gd-dock-tip" aria-hidden="true">
              {label}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

function QuickSearchDialog<T extends string>({
  workspaceName,
  views,
  onSelect,
  onClose,
}: {
  workspaceName: string;
  views: readonly WorkspaceViewDef<T>[];
  onSelect: (id: T) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  const labelId = useId();

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector("input")?.focus();
  }, []);

  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const results = views.filter((view) =>
    terms.every((t) => `${view.label} ${view.description} ${view.prompt}`.toLowerCase().includes(t))
  );

  return (
    <dialog
      className="gd-dialog"
      ref={ref}
      aria-labelledby={labelId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      <section className="gd-dialog-inner">
        <header>
          <h2 id={labelId}>Buscar en {workspaceName}</h2>
          <button
            type="button"
            className="gd-icon-button"
            aria-label="Cerrar búsqueda"
            onClick={() => ref.current?.close()}
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <label className="gd-search gd-command-input">
          <Search aria-hidden="true" />
          <input
            type="search"
            aria-label="Buscar vista o sección"
            placeholder="Ir a una sección..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="gd-quick-list">
          {results.map(({ id, label, description, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                onClose();
                onSelect(id);
              }}
            >
              <Icon aria-hidden={true} />
              <div>
                <strong>{label}</strong>
                <small>{description}</small>
              </div>
              <ChevronRight aria-hidden="true" />
            </button>
          ))}
          {results.length === 0 && (
            <p className="gd-empty" role="status">
              No encontramos secciones con ese criterio.
            </p>
          )}
        </div>
      </section>
    </dialog>
  );
}

interface WorkspaceShellProps<T extends string> {
  orgName: string;
  sedeName: string;
  views: readonly WorkspaceViewDef<T>[];
  activeView: T;
  onSelectView: (id: T) => void;
  onExit: () => void;
  exitLabel?: string;
  headActions?: ReactNode;
  extraHeaderAction?: ReactNode;
  footerLeft?: string;
  animationDeps?: unknown[];
  children: ReactNode;
}

export function WorkspaceShell<T extends string>({
  orgName,
  sedeName,
  views,
  activeView,
  onSelectView,
  onExit,
  exitLabel = "Salir",
  headActions,
  extraHeaderAction,
  footerLeft = "Gestión de donaciones",
  animationDeps = [],
  children,
}: WorkspaceShellProps<T>) {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const saved = localStorage.getItem("dona:theme");
      return saved === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  const [searchOpen, setSearchOpen] = useState(false);

  const root = useRef<HTMLDivElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try {
        localStorage.setItem("dona:theme", next);
      } catch {
        // ignore
      }
      return next;
    });
  };

  useEffect(() => {
    scrollArea.current?.scrollTo({ top: 0 });
  }, [activeView]);

  useGSAP(
    () => {
      const layer = content.current;
      if (!layer) return;
      const counts = layer.querySelectorAll<HTMLElement>("[data-gd-count]");
      gsap.set(layer, { clearProps: "opacity,filter" });
      if (reduced) {
        counts.forEach((el) => {
          const fmt = el.dataset.format as CountFormat;
          el.textContent = formatCount[fmt](Number(el.dataset.gdCount));
        });
        return;
      }
      const animate = gsap.timeline({ defaults: { ease: "power3.out" } });
      animate.fromTo(
        layer,
        { opacity: 0.55, filter: "blur(5px)" },
        { opacity: 1, filter: "blur(0px)", clearProps: "opacity,filter", duration: 0.3 },
        0
      );
      const enterItems = layer.querySelectorAll("[data-gd-enter]");
      if (enterItems.length) {
        animate.from(
          enterItems,
          { y: 16, opacity: 0, stagger: 0.04, duration: 0.45, clearProps: "transform,opacity" },
          0.03
        );
      }
      const bars = layer.querySelectorAll(".gd-stack-bar");
      const ring = layer.querySelector(".gd-donut-draw");
      const meters = layer.querySelectorAll(".gd-fill");
      if (bars.length) {
        animate.from(bars, { scaleY: 0, stagger: 0.03, duration: 0.42, clearProps: "transform" }, 0.14);
      }
      if (ring) {
        animate.fromTo(
          ring,
          { attr: { "stroke-dasharray": "0 100" } },
          { attr: { "stroke-dasharray": "100 0" }, duration: 0.7 },
          0.14
        );
      }
      if (meters.length) {
        animate.from(meters, { scaleX: 0, duration: 0.52, stagger: 0.04, clearProps: "transform" }, 0.16);
      }
      counts.forEach((el, index) => {
        const value = Number(el.dataset.gdCount);
        const fmt = el.dataset.format as CountFormat;
        const counter = { value: 0 };
        animate.to(
          counter,
          {
            value,
            duration: 0.65,
            onUpdate: () => {
              el.textContent = formatCount[fmt](counter.value);
            },
          },
          0.08 + index * 0.02
        );
      });
    },
    { scope: content, dependencies: [activeView, ...animationDeps, reduced], revertOnUpdate: true }
  );

  const current = views.find((v) => v.id === activeView) ?? views[0];
  const sync = useSyncStatus();

  const syncDotColor =
    sync.state === "syncing"
      ? "#38bdf8"
      : sync.state === "offline"
      ? "#f59e0b"
      : sync.state === "error"
      ? "#f87171"
      : sync.state === "local"
      ? "#94a3b8"
      : sync.pendingCount > 0
      ? "#fbbf24"
      : "#10b981";

  const syncLabel =
    sync.state === "local"
      ? "Solo local"
      : sync.state === "syncing"
      ? "Sincronizando..."
      : sync.state === "offline"
      ? sync.pendingCount > 0
        ? `Sin conexión (${sync.pendingCount})`
        : "Sin conexión"
      : sync.state === "error"
      ? "Error al sincronizar"
      : sync.pendingCount > 0
      ? `Pendientes (${sync.pendingCount})`
      : "Sincronizado";

  return (
    <div
      className="gd-app"
      data-theme={theme}
      ref={root}
      style={{ "--gd-panel-frost": "12px" } as CSSProperties}
    >
      <style>{dashboardStyles + donaWorkspaceStyles}</style>
      <img
        className="gd-background"
        src={`${import.meta.env.BASE_URL}workspace-bg.jpg`}
        alt=""
        aria-hidden="true"
        fetchPriority="high"
      />
      <div className="gd-surround">
        <header className="gd-top">
          <div className="gd-brand">
            <div>
              <strong>{orgName}</strong>
              <small>{sedeName}</small>
            </div>
          </div>

          <button
            type="button"
            className="gd-ask"
            aria-label={`Buscar vistas en ${orgName}`}
            onClick={() => setSearchOpen(true)}
          >
            <span className="gd-orb" aria-hidden="true" />
            <span className="gd-prompt" key={activeView}>
              {current.prompt}
            </span>
            <Search aria-hidden="true" className="gd-ask-search" />
          </button>

          <div className="gd-top-actions">
            <button
              type="button"
              className="dn-sync-pill"
              aria-label={syncLabel}
              title={sync.lastError ? `${syncLabel}: ${sync.lastError}` : syncLabel}
              onClick={() => void syncNow()}
            >
              <span
                className="dn-sync-dot"
                aria-hidden="true"
                style={{ background: syncDotColor }}
              />
              <span className="dn-sync-label">{syncLabel}</span>
            </button>
            {extraHeaderAction}
            <button
              title={theme === "light" ? "Cambiar a tema oscuro" : "Cambiar a tema claro"}
              type="button"
              className="gd-icon-button"
              aria-label={theme === "light" ? "Cambiar a tema oscuro" : "Cambiar a tema claro"}
              onClick={toggleTheme}
            >
              {theme === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="dn-exit-btn dn-exit-btn-salir"
              aria-label={exitLabel}
              title={exitLabel}
              onClick={onExit}
            >
              <LogOut aria-hidden="true" />
              <span className="dn-exit-label">{exitLabel}</span>
            </button>
          </div>
        </header>

        <div className="gd-stage-wrap">
          <GenericDock views={views} active={activeView} side onSelect={onSelectView} />
          <main className="gd-stage">
            <div className="gd-stage-scroll" ref={scrollArea}>
              <DemoBanner className="mb-3" />
              <header className="gd-view-head">
                <div>
                  <h1>{current.label}</h1>
                  <p>{current.description}</p>
                </div>
                {headActions && <div className="gd-view-actions">{headActions}</div>}
              </header>
              <div className="gd-content" ref={content} key={activeView} data-view={activeView}>
                {children}
              </div>
            </div>
          </main>
          <GenericDock views={views} active={activeView} onSelect={onSelectView} />
        </div>

        <footer className="gd-footer">
          <span>{footerLeft}</span>
          <span>Argentina · Red solidaria</span>
        </footer>
      </div>

      {searchOpen && (
        <QuickSearchDialog
          workspaceName={orgName}
          views={views}
          onSelect={onSelectView}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  );
}
