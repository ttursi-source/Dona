import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  Building2,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  House,
  Map,
  MapPin,
  Maximize2,
  Megaphone,
  Minimize2,
  Network,
  Presentation,
  Store,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import BlurText from "@/components/ui/BlurText";
import BrowserWindow from "@/components/ui/BrowserWindow";
import ShatterType from "@/components/ui/ShatterType";
import { DEMO_CODE } from "@/lib/seed";
import { loginLocal } from "@/lib/session";
import { ensureDemoSeedData, setCurrentSede } from "@/lib/store";
import "./DemoPresentation.css";

interface SlideMeta {
  id: string;
  shortTitle: string;
  liveTitle: string;
}

const SLIDES: SlideMeta[] = [
  {
    id: "hook",
    shortTitle: "El gancho",
    liveTitle: "¿Cuántas veces tiraste ropa en perfectas condiciones porque ya no la querías?",
  },
  {
    id: "stats",
    shortTitle: "El dato",
    liveTitle: "Solo un 24% de los argentinos donó alguna vez y residuos textiles por año",
  },
  {
    id: "mission",
    shortTitle: "Nuestra misión",
    liveTitle: "Nosotros queremos fomentar las donaciones en general",
  },
  {
    id: "triangle",
    shortTitle: "¿Cómo lo haríamos?",
    liveTitle: "Triángulo de valor entre Marcas, Clientes y ONGs",
  },
  {
    id: "map",
    shortTitle: "Mapa CABA",
    liveTitle: "Mapa en vivo con 331 organizaciones verificadas en CABA",
  },
  {
    id: "problem",
    shortTitle: "El problema",
    liveTitle: "Pero tuvimos un problema: las ONGs tenían otra necesidad",
  },
  {
    id: "tool",
    shortTitle: "La herramienta",
    liveTitle: "La herramienta que creamos si sos una organización",
  },
  {
    id: "org-demo",
    shortTitle: "Panel en vivo",
    liveTitle: "Probalo en vivo: Panel para Organizaciones y Modo Demo",
  },
  {
    id: "business-model",
    shortTitle: "Modelo de negocio",
    liveTitle: "Modelo de negocio: más exposición para marcas y comisión de 3 dólares por cliente",
  },
  {
    id: "roadmap",
    shortTitle: "Roadmap",
    liveTitle: "Roadmap de impacto y escala de doná",
  },
  {
    id: "first-in-region",
    shortTitle: "Pioneros en la región",
    liveTitle: "doná va a ser la primera plataforma de la región en...",
  },
  {
    id: "thanks",
    shortTitle: "Muchas gracias",
    liveTitle: "Muchas gracias",
  },
];

const NUMBER_FORMAT = new Intl.NumberFormat("es-AR");

function prefersReducedMotionNow(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function SlideStats() {
  const [wasteVisible, setWasteVisible] = useState(() => prefersReducedMotionNow());
  const [minTons, setMinTons] = useState(() => (prefersReducedMotionNow() ? 550000 : 0));
  const [maxTons, setMaxTons] = useState(() => (prefersReducedMotionNow() ? 900000 : 0));

  useEffect(() => {
    const reduced = prefersReducedMotionNow();
    if (reduced) {
      setWasteVisible(true);
      setMinTons(550000);
      setMaxTons(900000);
      return;
    }

    setWasteVisible(false);
    setMinTons(0);
    setMaxTons(0);

    let rafId = 0;
    const delayTimer = window.setTimeout(() => {
      setWasteVisible(true);
      const durationMs = 1150;
      const startTime = performance.now();

      const step = (now: number) => {
        const elapsed = Math.min(1, (now - startTime) / durationMs);
        const eased = 1 - Math.pow(1 - elapsed, 3);
        setMinTons(Math.round(550000 * eased));
        setMaxTons(Math.round(900000 * eased));
        if (elapsed < 1) {
          rafId = window.requestAnimationFrame(step);
        } else {
          setMinTons(550000);
          setMaxTons(900000);
        }
      };

      rafId = window.requestAnimationFrame(step);
    }, 5000);

    return () => {
      window.clearTimeout(delayTimer);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-5 text-center">
      <div className="w-full rounded-3xl border border-slate-800/90 bg-[#111827]/80 px-6 py-6 shadow-[0_20px_50px_rgba(0,0,0,0.45)] sm:px-8 sm:py-8">
        <h1 className="font-baskerville text-2xl font-bold leading-tight text-[#f8fafc] sm:text-4xl lg:text-[2.75rem]">
          <span className="text-[#38bdf8]">Solo un 24%</span> de los argentinos donó alguna vez
        </h1>
      </div>

      <div
        className={`relative w-full rounded-3xl border px-6 py-5 transition duration-500 sm:px-8 sm:py-7 ${
          wasteVisible
            ? "translate-y-0 border-amber-400/50 bg-[#0f172a]/95 opacity-100 shadow-[0_18px_45px_rgba(251,191,36,0.12)]"
            : "pointer-events-none translate-y-4 border-slate-800/60 bg-[#0f172a]/40 opacity-0"
        }`}
        aria-live="polite"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-[#fbbf24]">
          Impacto ambiental directo
        </p>

        <div className="mt-2.5 flex flex-wrap items-baseline justify-center gap-2.5 font-baskerville text-2xl font-bold tabular-nums text-[#f8fafc] sm:gap-4 sm:text-4xl lg:text-[2.75rem]">
          <span>entre</span>
          <span className="rounded-2xl border border-[#38bdf8]/40 bg-[#111827] px-3.5 py-1 text-[#38bdf8]">
            {NUMBER_FORMAT.format(minTons)}
          </span>
          <span>y</span>
          <span className="rounded-2xl border border-[#fbbf24]/50 bg-[#111827] px-3.5 py-1 text-[#fbbf24]">
            {NUMBER_FORMAT.format(maxTons)}
          </span>
        </div>

        <p className="mt-2.5 text-base font-semibold text-[#cbd5e1] sm:text-xl">
          toneladas de residuos textiles por año en la Argentina
        </p>
      </div>
    </section>
  );
}

type TriangleVertexId = "ongs" | "marcas" | "clientes";

function SlideTriangle() {
  const [selected, setSelected] = useState<TriangleVertexId>("ongs");

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 text-center">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#38bdf8]/40 bg-[#111827]/85 px-4 py-1 text-xs font-bold uppercase tracking-widest text-[#7dd3fc]">
          El modelo
        </span>
        <h1 className="font-baskerville mt-1.5 text-3xl font-bold tracking-tight text-[#f8fafc] sm:text-4xl">
          ¿Cómo lo haríamos?
        </h1>
        <p className="mt-1 text-sm text-[#cbd5e1] sm:text-base">
          Un círculo virtuoso donde ganan <strong className="text-[#38bdf8]">Marcas</strong>,{" "}
          <strong className="text-[#38bdf8]">Clientes</strong> y{" "}
          <strong className="text-[#38bdf8]">ONGs</strong>.
        </p>
      </div>

      <figure className="relative w-full max-w-4xl rounded-3xl border border-slate-800/90 bg-[#111827]/75 p-4 shadow-[0_22px_54px_rgba(0,0,0,0.45)] sm:p-5">
        <figcaption className="sr-only">
          Diagrama triangular que conecta ONGs en la cima con Marcas abajo a la izquierda y Clientes abajo a la derecha mediante cupones QR y donaciones.
        </figcaption>

        {/* Single responsive Triangle stage (stack on mobile, equilateral layout on sm+) */}
        <div className="grid gap-3 sm:relative sm:block sm:h-[268px] sm:w-full">
          <svg
            aria-hidden="true"
            viewBox="0 0 800 268"
            className="pointer-events-none hidden h-full w-full sm:absolute sm:inset-0 sm:block"
          >
            <defs>
              <marker
                id="demo-arrow"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
              </marker>
              <marker
                id="demo-arrow-amber"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#fbbf24" />
              </marker>
            </defs>

            {/* Triangle edges */}
            <line
              x1="312"
              y1="76"
              x2="195"
              y2="174"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeOpacity="0.65"
              className="demo-triangle-flow"
              markerEnd="url(#demo-arrow)"
            />
            <line
              x1="488"
              y1="76"
              x2="605"
              y2="174"
              stroke="#7dd3fc"
              strokeWidth="2.5"
              strokeOpacity="0.65"
              className="demo-triangle-flow"
              markerStart="url(#demo-arrow)"
            />
            <line
              x1="285"
              y1="216"
              x2="508"
              y2="216"
              stroke="#fbbf24"
              strokeWidth="2.5"
              strokeOpacity="0.75"
              className="demo-triangle-flow"
              markerEnd="url(#demo-arrow-amber)"
            />

            {/* Edge badges rendered as crisp vector pills */}
            <g transform="translate(152 108)">
              <rect x="0" y="0" width="136" height="24" rx="12" fill="#090d16" stroke="#38bdf8" strokeOpacity="0.45" />
              <text x="68" y="16" textAnchor="middle" fill="#cbd5e1" fontSize="11.5" fontWeight="700">
                Validación QR
              </text>
            </g>
            <g transform="translate(512 108)">
              <rect x="0" y="0" width="136" height="24" rx="12" fill="#090d16" stroke="#7dd3fc" strokeOpacity="0.45" />
              <text x="68" y="16" textAnchor="middle" fill="#cbd5e1" fontSize="11.5" fontWeight="700">
                Donan bienes
              </text>
            </g>
            <g transform="translate(352 232)">
              <rect x="0" y="0" width="96" height="24" rx="12" fill="#090d16" stroke="#fbbf24" strokeOpacity="0.55" />
              <text x="48" y="16" textAnchor="middle" fill="#fbbf24" fontSize="11.5" fontWeight="700">
                Cupones
              </text>
            </g>
          </svg>

          {/* Top vertex: ONGs */}
          <button
            type="button"
            onClick={() => setSelected("ongs")}
            className={`demo-focus-ring flex w-full flex-col items-start rounded-2xl border px-4 py-2.5 text-left transition cursor-pointer sm:absolute sm:left-1/2 sm:top-1 sm:w-64 sm:-translate-x-1/2 sm:items-center sm:text-center ${
              selected === "ongs"
                ? "border-[#38bdf8] bg-[#0f172a] shadow-[0_0_28px_rgba(56,189,248,0.28)]"
                : "border-slate-700 bg-[#090d16]/95 hover:border-[#38bdf8]/70"
            }`}
          >
            <div className="flex items-center gap-2 text-[#38bdf8]">
              <Building2 className="h-5 w-5" aria-hidden="true" />
              <span className="font-baskerville text-lg font-bold text-[#f8fafc]">ONGs</span>
            </div>
            <span className="mt-0.5 text-xs font-medium text-[#cbd5e1]">
              Reciben donaciones constantes
            </span>
          </button>

          {/* Bottom-left vertex: Marcas */}
          <button
            type="button"
            onClick={() => setSelected("marcas")}
            className={`demo-focus-ring flex w-full flex-col items-start rounded-2xl border px-4 py-2.5 text-left transition cursor-pointer sm:absolute sm:bottom-3 sm:left-4 sm:w-64 sm:items-center sm:text-center ${
              selected === "marcas"
                ? "border-[#38bdf8] bg-[#0f172a] shadow-[0_0_28px_rgba(56,189,248,0.28)]"
                : "border-slate-700 bg-[#090d16]/95 hover:border-[#38bdf8]/70"
            }`}
          >
            <div className="flex items-center gap-2 text-[#fbbf24]">
              <Store className="h-5 w-5" aria-hidden="true" />
              <span className="font-baskerville text-lg font-bold text-[#f8fafc]">Marcas</span>
            </div>
            <span className="mt-0.5 text-xs font-medium text-[#cbd5e1]">
              Dan cupones y ganan clientes
            </span>
          </button>

          {/* Bottom-right vertex: Clientes */}
          <button
            type="button"
            onClick={() => setSelected("clientes")}
            className={`demo-focus-ring flex w-full flex-col items-start rounded-2xl border px-4 py-2.5 text-left transition cursor-pointer sm:absolute sm:bottom-3 sm:right-4 sm:w-64 sm:items-center sm:text-center ${
              selected === "clientes"
                ? "border-[#38bdf8] bg-[#0f172a] shadow-[0_0_28px_rgba(56,189,248,0.28)]"
                : "border-slate-700 bg-[#090d16]/95 hover:border-[#38bdf8]/70"
            }`}
          >
            <div className="flex items-center gap-2 text-[#7dd3fc]">
              <Users className="h-5 w-5" aria-hidden="true" />
              <span className="font-baskerville text-lg font-bold text-[#f8fafc]">Clientes</span>
            </div>
            <span className="mt-0.5 text-xs font-medium text-[#cbd5e1]">
              Donan fácil y reciben promos
            </span>
          </button>
        </div>
      </figure>
    </section>
  );
}

const ROADMAP_PHASES = [
  {
    phase: "Hoy · MVP funcionando",
    status: "Completado",
    highlight: true,
    metric: "331 ONGs en CABA + IA + BI",
  },
  {
    phase: "Meses 1–3 · Si donan 10.000 personas",
    status: "10.000 donantes",
    highlight: false,
    metric: "US$ 30.000 en comisiones · ~25 toneladas rescatadas",
  },
  {
    phase: "Meses 4–6 · Si donan 30.000 personas",
    status: "30.000 donantes",
    highlight: false,
    metric: "US$ 90.000 en comisiones · ~75 toneladas rescatadas",
  },
  {
    phase: "Meses 7–12 · Si donan 50.000 personas",
    status: "50.000 donantes",
    highlight: false,
    metric: "US$ 150.000 en comisiones · ~125 toneladas rescatadas",
  },
];

const SLIDE_EXIT_MS = 380;
const SLIDE_COOLDOWN_MS = 1500;

export default function DemoPresentation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [index, setIndex] = useState(() => {
    const raw = Number(searchParams.get("slide"));
    if (Number.isInteger(raw) && raw >= 1 && raw <= SLIDES.length) {
      return raw - 1;
    }
    return 0;
  });
  const [navDirection, setNavDirection] = useState<"forward" | "backward">("forward");
  const [isExiting, setIsExiting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const deckRef = useRef<HTMLDivElement>(null);
  const slideStageRef = useRef<HTMLDivElement>(null);
  const lockRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);
  const unlockTimerRef = useRef<number | null>(null);
  const mapaUrl = `${import.meta.env.BASE_URL}mapa.html`;
  const isFirst = index === 0;
  const isLast = index === SLIDES.length - 1;
  const activeSlide = SLIDES[index];

  // Clear pending transition timers on unmount
  useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
      if (unlockTimerRef.current !== null) {
        window.clearTimeout(unlockTimerRef.current);
      }
    };
  }, []);

  // Sync document.title while presenting and restore on unmount
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `Demo (${index + 1}/${SLIDES.length}): ${activeSlide.shortTitle} | doná`;
    return () => {
      document.title = previousTitle;
    };
  }, [index, activeSlide.shortTitle]);

  // Keep fullscreen indicator synced with Escape / browser chrome exits
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const goToSlide = useCallback(
    (target: number) => {
      const clamped = Math.max(0, Math.min(SLIDES.length - 1, target));
      if (clamped === index || lockRef.current) return;

      const direction = clamped > index ? "forward" : "backward";

      if (prefersReducedMotionNow()) {
        setNavDirection(direction);
        setIndex(clamped);
        slideStageRef.current?.scrollTo?.({ top: 0 });
        return;
      }

      lockRef.current = true;
      setIsLocked(true);
      setNavDirection(direction);
      setIsExiting(true);

      exitTimerRef.current = window.setTimeout(() => {
        setIndex(clamped);
        setIsExiting(false);
        slideStageRef.current?.scrollTo?.({ top: 0 });
        exitTimerRef.current = null;
      }, SLIDE_EXIT_MS);

      unlockTimerRef.current = window.setTimeout(() => {
        lockRef.current = false;
        setIsLocked(false);
        unlockTimerRef.current = null;
      }, SLIDE_COOLDOWN_MS);
    },
    [index]
  );

  // Keyboard shortcuts for presenter remote / arrows / number keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        goToSlide(index + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goToSlide(index - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        goToSlide(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goToSlide(SLIDES.length - 1);
      } else if (/^[1-9]$/.test(e.key)) {
        const numeric = Number(e.key) - 1;
        if (numeric >= 0 && numeric < SLIDES.length) {
          e.preventDefault();
          goToSlide(numeric);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, goToSlide]);

  const markReturnToDemo = useCallback(() => {
    try {
      sessionStorage.setItem("dona:demoReturnSlide", "8");
    } catch {
      // ignore storage errors
    }
  }, []);

  const goOrgPanelFromDemo = useCallback(() => {
    markReturnToDemo();
    navigate("/organizacion?from=demo");
  }, [markReturnToDemo, navigate]);

  const launchDemoCentral = useCallback(async () => {
    markReturnToDemo();
    const { orgId } = ensureDemoSeedData();
    const res = await loginLocal("central", orgId, undefined, DEMO_CODE);
    if (!res.ok) {
      toast.error(res.error ?? "No pudimos abrir el modo demo central.");
      return;
    }
    navigate(`/central/${orgId}`);
  }, [markReturnToDemo, navigate]);

  const launchDemoSede = useCallback(async () => {
    markReturnToDemo();
    const { orgId, affiliatedSedes } = ensureDemoSeedData();
    const targetSedeId =
      affiliatedSedes.find((s) => s.id === "caritas-boedo")?.id ??
      affiliatedSedes[0]?.id ??
      "caritas-boedo";
    const res = await loginLocal("sede", orgId, targetSedeId, DEMO_CODE);
    if (!res.ok) {
      toast.error(res.error ?? "No pudimos abrir el modo demo afiliada.");
      return;
    }
    setCurrentSede(targetSedeId);
    navigate(`/sede/${targetSedeId}`);
  }, [markReturnToDemo, navigate]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (deckRef.current?.requestFullscreen) {
        await deckRef.current.requestFullscreen();
      }
    } catch {
      // Ignore fullscreen denial in restricted iframes / test environments
    }
  };

  const slideContent = useMemo(() => {
    switch (index) {
      case 0:
        return (
          <section className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center text-center">
            <BlurText
              as="h1"
              text="¿Cuántas veces tiraste ropa en perfectas condiciones porque ya no la querías?"
              highlightPhrase="en perfectas condiciones"
              highlightColor="#38bdf8"
              effect="blur"
              animateBy="words"
              direction="top"
              staggerFrom="start"
              trigger="load"
              delay={120}
              stepDuration={0.35}
              blur={10}
              distance={45}
              className="font-baskerville justify-center text-center text-3xl font-bold leading-snug tracking-tight text-[#f8fafc] sm:text-5xl md:text-6xl"
            />
          </section>
        );

      case 1:
        return <SlideStats />;

      case 2:
        return (
          <section className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center text-center">
            <ShatterType
              text="Nosotros queremos fomentar las donaciones en general"
              highlightPhrase="fomentar las donaciones en general"
              highlightColor="#38bdf8"
              className="font-baskerville max-w-4xl text-3xl font-bold leading-tight text-[#f8fafc] sm:text-5xl md:text-6xl"
            />
          </section>
        );

      case 3:
        return <SlideTriangle />;

      case 4:
        return (
          <section className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="font-baskerville text-2xl font-bold text-[#f8fafc] sm:text-3xl">
                Ahora sí: el mapa con todas las ONGs
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#38bdf8]/40 bg-[#111827]/90 px-3 py-1 text-xs font-bold text-[#38bdf8]">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                331 organizaciones verificadas en CABA
              </span>
            </div>

            <BrowserWindow
              url="https://dona.app"
              tabTitle="doná · Mapa CABA"
              badge="331 ONGs en CABA"
              externalHref={mapaUrl}
              iframeSrc={mapaUrl}
              iframeTitle="Mapa interactivo de las 331 organizaciones receptoras de donaciones en CABA"
            />
          </section>
        );

      case 5:
        return (
          <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-7 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/50 bg-[#111827]/90 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#fbbf24]">
              El punto de inflexión
            </span>

            <div>
              <h1 className="font-baskerville text-3xl font-bold text-[#f8fafc] sm:text-5xl md:text-6xl">
                Pero tuvimos un problema...
              </h1>
              <p className="mx-auto mt-4 max-w-3xl text-lg font-semibold leading-relaxed text-[#38bdf8] sm:text-2xl">
                Las ONGs tenían otra necesidad si queríamos aumentar el flujo de donaciones.
              </p>
            </div>

            <div className="grid w-full gap-4 sm:grid-cols-3">
              <article className="flex flex-col items-center justify-center rounded-3xl border border-slate-800 bg-[#111827]/85 p-6 text-center shadow-lg">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/15 text-[#fbbf24]">
                  <Clock className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-lg font-bold text-[#f8fafc]">
                  Registro manual y caótico
                </h2>
              </article>

              <article className="flex flex-col items-center justify-center rounded-3xl border border-slate-800 bg-[#111827]/85 p-6 text-center shadow-lg">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#38bdf8]/15 text-[#38bdf8]">
                  <Network className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-lg font-bold text-[#f8fafc]">Sedes desconectadas</h2>
              </article>

              <article className="flex flex-col items-center justify-center rounded-3xl border border-slate-800 bg-[#111827]/85 p-6 text-center shadow-lg">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#7dd3fc]/15 text-[#7dd3fc]">
                  <BarChart3 className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-lg font-bold text-[#f8fafc]">Sin trazabilidad ni datos</h2>
              </article>
            </div>
          </section>
        );

      case 6:
        return (
          <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 text-center">
            <div>
              <h1 className="font-baskerville text-3xl font-bold leading-tight text-[#f8fafc] sm:text-5xl">
                La herramienta que creamos si sos una organización
              </h1>
              <p className="mx-auto mt-2 max-w-3xl text-sm text-[#cbd5e1] sm:text-base">
                Carga visual ultrarrápida para cada sede y tablero Business Intelligence para la
                Sede Central.
              </p>
            </div>

            <div className="grid w-full gap-4 text-left sm:grid-cols-2">
              <article className="flex items-center gap-4 rounded-3xl border border-slate-800 bg-[#111827]/85 p-6 shadow-lg">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#38bdf8]/15 text-[#38bdf8]">
                  <Camera className="h-6 w-6" aria-hidden="true" />
                </span>
                <h2 className="text-xl font-bold text-[#f8fafc]">Foto + Gemini IA</h2>
              </article>

              <article className="flex items-center gap-4 rounded-3xl border border-slate-800 bg-[#111827]/85 p-6 shadow-lg">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#38bdf8]/15 text-[#38bdf8]">
                  <Building2 className="h-6 w-6" aria-hidden="true" />
                </span>
                <h2 className="text-xl font-bold text-[#f8fafc]">Trazabilidad de donantes</h2>
              </article>

              <article className="flex items-center gap-4 rounded-3xl border border-slate-800 bg-[#111827]/85 p-6 shadow-lg">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#38bdf8]/15 text-[#38bdf8]">
                  <FileSpreadsheet className="h-6 w-6" aria-hidden="true" />
                </span>
                <h2 className="text-xl font-bold text-[#f8fafc]">Google Sheets y Drive</h2>
              </article>

              <article className="flex items-center gap-4 rounded-3xl border border-slate-800 bg-[#111827]/85 p-6 shadow-lg">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#38bdf8]/15 text-[#38bdf8]">
                  <BarChart3 className="h-6 w-6" aria-hidden="true" />
                </span>
                <h2 className="text-xl font-bold text-[#f8fafc]">
                  Business Intelligence central
                </h2>
              </article>
            </div>
          </section>
        );

      case 7:
        return (
          <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 text-center">
            <div>
              <h1 className="font-baskerville text-3xl font-bold leading-tight text-[#f8fafc] sm:text-5xl">
                Probalo en vivo: Panel para Organizaciones
              </h1>
              <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-[#cbd5e1] sm:text-base">
                Entrá al panel de organizaciones y elegí el <strong className="text-[#38bdf8]">modo demo</strong> para ver cómo lo vive la <strong className="text-[#f8fafc]">Sede Central</strong> y cómo trabajan las <strong className="text-[#f8fafc]">sedes afiliadas</strong>.
              </p>
            </div>

            <button
              type="button"
              onClick={goOrgPanelFromDemo}
              className="demo-focus-ring font-baskerville inline-flex min-h-[56px] items-center justify-center gap-3 rounded-full bg-[#38bdf8] px-8 py-4 text-base font-bold text-[#090d16] shadow-[0_10px_34px_rgba(56,189,248,0.3)] transition hover:-translate-y-0.5 hover:bg-[#56ccf9] cursor-pointer"
            >
              <Presentation className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>Ir al Panel de Organizaciones</span>
              <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
            </button>

            <div className="grid w-full gap-4 text-left sm:grid-cols-2">
              <div className="flex flex-col justify-between rounded-3xl border border-[#38bdf8]/40 bg-[#111827]/90 p-5 shadow-lg">
                <div>
                  <div className="flex items-center gap-2.5 text-[#38bdf8]">
                    <BarChart3 className="h-5 w-5" aria-hidden="true" />
                    <h2 className="text-lg font-bold text-[#f8fafc]">Vista Sede Central</h2>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[#cbd5e1]">
                    Business Intelligence en tiempo real, stock consolidado y actividad de todas las sedes de la red Cáritas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void launchDemoCentral()}
                  className="demo-focus-ring mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-[#38bdf8]/60 bg-[#0f172a] px-5 py-2.5 text-sm font-bold text-[#7dd3fc] transition hover:border-[#38bdf8] hover:text-[#f8fafc] cursor-pointer"
                >
                  <span>Modo Demo · Sede Central</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="flex flex-col justify-between rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-5 shadow-lg">
                <div>
                  <div className="flex items-center gap-2.5 text-[#7dd3fc]">
                    <Store className="h-5 w-5" aria-hidden="true" />
                    <h2 className="text-lg font-bold text-[#f8fafc]">Vista Sedes Afiliadas</h2>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[#cbd5e1]">
                    Registro en segundos con cámara + Gemini IA y asignación del donante en una sede afiliada (ej. Cáritas Boedo).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void launchDemoSede()}
                  className="demo-focus-ring mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-slate-600 bg-[#090d16] px-5 py-2.5 text-sm font-bold text-[#f8fafc] transition hover:border-[#38bdf8] hover:text-[#38bdf8] cursor-pointer"
                >
                  <span>Modo Demo · Sedes Afiliadas</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>
        );

      case 8:
        return (
          <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 text-center">
            <div>
              <h1 className="font-baskerville text-3xl font-bold text-[#f8fafc] sm:text-5xl">
                Modelo de negocio
              </h1>
              <p className="mx-auto mt-2.5 max-w-3xl text-sm text-[#cbd5e1] sm:text-base">
                100% gratuito para quienes donan y para las ONGs. Monetizamos el valor comercial que generamos para las marcas aliadas.
              </p>
            </div>

            <div className="demo-business-grid text-left">
              <article className="demo-business-card rounded-3xl border border-[#38bdf8]/40 bg-[#111827]/90 p-6 shadow-lg">
                <div className="demo-business-card-body">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#38bdf8]/15 text-[#38bdf8]">
                    <Megaphone className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h2 className="demo-business-card-title font-baskerville font-bold text-[#f8fafc]">
                    Más exposición para las marcas
                  </h2>
                </div>
              </article>

              <article className="demo-business-card rounded-3xl border border-amber-400/45 bg-[#0f172a]/95 p-6 shadow-[0_18px_45px_rgba(251,191,36,0.1)]">
                <div className="demo-business-card-body">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-[#fbbf24]">
                    <BadgeDollarSign className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h2 className="demo-business-card-title font-baskerville font-bold text-[#f8fafc]">
                    Comisión por cliente efectivo
                  </h2>
                  <span className="demo-business-card-price font-baskerville shrink-0 whitespace-nowrap rounded-2xl border border-amber-400/50 bg-[#111827] px-4 py-1.5 text-xl font-bold tabular-nums text-[#fbbf24] sm:text-2xl">
                    US$ 3
                  </span>
                </div>
              </article>
            </div>
          </section>
        );

      case 9:
        return (
          <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-5 text-center">
            <div>
              <h1 className="font-baskerville text-3xl font-bold text-[#f8fafc] sm:text-5xl">
                Roadmap
              </h1>
            </div>

            <ol className="grid w-full gap-4 text-left sm:grid-cols-2">
              {ROADMAP_PHASES.map((item, idx) => (
                <li
                  key={item.phase}
                  className={`rounded-3xl border p-5 sm:p-6 shadow-lg ${
                    item.highlight
                      ? "border-[#38bdf8]/65 bg-[#0f172a]/95 shadow-[0_14px_38px_rgba(56,189,248,0.16)]"
                      : "border-slate-800 bg-[#111827]/85"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#38bdf8]/15 text-xs font-bold text-[#38bdf8]">
                      {idx + 1}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                        item.highlight
                          ? "bg-[#38bdf8] text-[#090d16]"
                          : "border border-slate-700 bg-slate-800/80 text-[#7dd3fc]"
                      }`}
                    >
                      {item.highlight && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                      {item.status}
                    </span>
                  </div>
                  <h2 className="mt-3 text-base font-bold text-[#f8fafc] sm:text-lg">
                    {item.phase}
                  </h2>
                  <p className="mt-1.5 text-sm font-bold text-[#fbbf24]">{item.metric}</p>
                </li>
              ))}
            </ol>
          </section>
        );

      case 10:
        return (
          <section className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center text-center">
            <BlurText
              as="h1"
              text="doná va a ser la primera plataforma de la región en..."
              highlightPhrase="doná"
              highlightColor="#38bdf8"
              effect="blur"
              animateBy="words"
              direction="top"
              staggerFrom="start"
              trigger="load"
              delay={120}
              stepDuration={0.35}
              blur={10}
              distance={45}
              className="font-baskerville justify-center text-center text-3xl font-bold leading-snug tracking-tight text-[#f8fafc] sm:text-5xl md:text-6xl"
            />
          </section>
        );

      case 11:
      default:
        return (
          <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center text-center">
            <div className="flex flex-1 flex-col items-center justify-center py-6">
              <h1 className="font-baskerville text-[clamp(3.75rem,9vw,8rem)] font-bold leading-none tracking-tight text-[#f8fafc]">
                Muchas gracias
              </h1>
            </div>

            <div className="flex shrink-0 flex-col items-center gap-4 pb-1 pt-4">
              <div className="flex items-center justify-center gap-3">
                <Link
                  to="/"
                  aria-label="Inicio"
                  className="demo-focus-ring inline-flex aspect-square min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border border-slate-700 bg-[#111827] text-[#38bdf8] transition hover:-translate-y-0.5 hover:border-[#38bdf8] hover:bg-[#1e293b]"
                >
                  <House className="h-5 w-5" aria-hidden="true" />
                </Link>
                <a
                  href={mapaUrl}
                  aria-label="Abrir Mapa CABA"
                  className="demo-focus-ring inline-flex aspect-square min-h-[48px] min-w-[48px] items-center justify-center rounded-xl bg-[#38bdf8] text-[#090d16] shadow-[0_8px_24px_rgba(56,189,248,0.28)] transition hover:-translate-y-0.5 hover:bg-[#56ccf9]"
                >
                  <Map className="h-5 w-5" aria-hidden="true" />
                </a>
                <Link
                  to="/organizacion"
                  aria-label="Panel de Organizaciones"
                  className="demo-focus-ring inline-flex aspect-square min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border border-[#38bdf8]/45 bg-[#111827] text-[#38bdf8] transition hover:-translate-y-0.5 hover:border-[#38bdf8] hover:bg-[#1e293b]"
                >
                  <Building2 className="h-5 w-5" aria-hidden="true" />
                </Link>
              </div>

              <p className="text-sm font-medium text-[#cbd5e1] sm:text-base">
                <strong className="text-[#f8fafc]">Tomás Tursi</strong> · tursitomas@gmail.com ·
                +54 11 31663378
              </p>
            </div>
          </section>
        );
    }
  }, [index, mapaUrl]);

  return (
    <div
      ref={deckRef}
      className="relative flex h-svh min-h-svh w-full flex-col overflow-hidden bg-[#090d16] text-[#f8fafc]"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 75% 45% at 50% 18%, rgba(56, 189, 248, 0.14), rgba(9, 13, 22, 0) 70%)",
      }}
    >
      {/* Live region announcing current slide for assistive technology */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {`Diapositiva ${index + 1} de ${SLIDES.length}: ${activeSlide.liveTitle}`}
      </div>

      {/* Top presentation bar: home link, progress track & fullscreen */}
      <header className="relative z-20 flex shrink-0 items-center justify-between gap-3 border-b border-slate-800/70 bg-[#090d16]/85 px-4 py-3 backdrop-blur-md sm:px-6">
        <Link
          to="/"
          className="demo-focus-ring inline-flex min-h-[36px] items-center gap-2 rounded-full border border-slate-700/80 bg-[#111827]/85 px-3.5 py-1.5 text-xs font-semibold text-[#cbd5e1] transition hover:border-[#38bdf8] hover:text-[#f8fafc]"
        >
          <ArrowLeft className="h-4 w-4 text-[#38bdf8]" aria-hidden="true" />
          <span>Inicio</span>
        </Link>

        {/* Progress indicator across the 9 slides */}
        <div className="hidden max-w-sm flex-1 items-center gap-3 sm:flex">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-[#38bdf8] transition-[width] duration-300"
              style={{ width: `${((index + 1) / SLIDES.length) * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-[#94a3b8]">
            {index + 1}/{SLIDES.length}
          </span>
        </div>

        {/* Fullscreen toggle */}
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          className="demo-focus-ring inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full border border-slate-700/80 bg-[#111827]/85 text-[#cbd5e1] transition hover:border-[#38bdf8] hover:text-[#f8fafc] cursor-pointer"
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </header>

      {/* Left-side vertical dot rail for instant direct slide navigation */}
      <nav
        aria-label="Diapositivas"
        className="fixed left-2 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-1 sm:left-4"
      >
        {SLIDES.map((s, slideIdx) => {
          const active = slideIdx === index;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => goToSlide(slideIdx)}
              aria-label={`Ir a diapositiva ${slideIdx + 1}: ${s.shortTitle}`}
              aria-current={active ? "step" : undefined}
              className="demo-focus-ring group relative flex min-h-[28px] min-w-[28px] items-center justify-center rounded-full cursor-pointer"
            >
              <span
                aria-hidden="true"
                className={`block rounded-full transition-all duration-200 ${
                  active
                    ? "h-7 w-2.5 bg-[#38bdf8] shadow-[0_0_14px_rgba(56,189,248,0.85)]"
                    : "h-2.5 w-2.5 bg-slate-500/75 group-hover:scale-125 group-hover:bg-[#7dd3fc]"
                }`}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-9 hidden whitespace-nowrap rounded-full border border-slate-700 bg-[#090d16]/95 px-2.5 py-1 text-xs font-semibold text-[#f8fafc] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 sm:inline-block"
              >
                {String(slideIdx + 1).padStart(2, "0")} · {s.shortTitle}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Main slide stage */}
      <main
        ref={slideStageRef}
        className="demo-slide-stage relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto pl-12 pr-4 py-4 sm:pl-16 sm:pr-10 sm:py-5"
      >
        <div
          key={activeSlide.id}
          data-direction={navDirection}
          data-exiting={isExiting ? "true" : "false"}
          className={`demo-enter-card flex w-full flex-col ${
            activeSlide.id === "map"
              ? "h-full flex-1 min-h-0"
              : activeSlide.id === "thanks"
                ? "min-h-full flex-1"
                : "my-auto"
          }`}
        >
          {slideContent}
        </div>
      </main>

      {/* Large bottom Previous / Next slide navigation arrows */}
      <footer className="relative z-20 shrink-0 border-t border-slate-800/70 bg-[#090d16]/90 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-3.5">
        <nav
          aria-label="Control de diapositivas"
          className="mx-auto flex max-w-3xl items-center justify-between gap-4"
        >
          <button
            type="button"
            aria-label="Diapositiva anterior"
            aria-disabled={isFirst || isLocked}
            onClick={() => {
              if (!isFirst && !lockRef.current) goToSlide(index - 1);
            }}
            className={`demo-focus-ring inline-flex min-h-[56px] min-w-[76px] items-center justify-center rounded-full border transition sm:min-w-[104px] ${
              isFirst
                ? "cursor-not-allowed border-slate-800 bg-[#111827]/45 text-slate-600"
                : isLocked
                  ? "cursor-wait border-slate-700 bg-[#111827]/80 text-[#94a3b8] opacity-55"
                  : "cursor-pointer border-slate-600 bg-[#111827] text-[#f8fafc] shadow-md hover:-translate-y-0.5 hover:border-[#38bdf8] hover:bg-[#1e293b]"
            }`}
          >
            <ChevronLeft className="h-7 w-7" aria-hidden="true" />
          </button>

          <div className="flex items-center justify-center text-center">
            <span className="text-sm font-bold tabular-nums tracking-wider text-[#38bdf8]">
              {index + 1} / {SLIDES.length}
            </span>
          </div>

          <button
            type="button"
            aria-label="Siguiente diapositiva"
            aria-disabled={isLast || isLocked}
            onClick={() => {
              if (!isLast && !lockRef.current) goToSlide(index + 1);
            }}
            className={`demo-focus-ring inline-flex min-h-[56px] min-w-[76px] items-center justify-center rounded-full transition sm:min-w-[104px] ${
              isLast
                ? "cursor-not-allowed border border-slate-800 bg-[#111827]/45 text-slate-600"
                : isLocked
                  ? "cursor-wait bg-[#38bdf8]/65 text-[#090d16] opacity-55"
                  : "cursor-pointer bg-[#38bdf8] text-[#090d16] shadow-[0_8px_28px_rgba(56,189,248,0.35)] hover:-translate-y-0.5 hover:bg-[#56ccf9]"
            }`}
          >
            <ChevronRight className="h-7 w-7" aria-hidden="true" />
          </button>
        </nav>
      </footer>
    </div>
  );
}
