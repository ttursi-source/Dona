import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  PlusCircle,
  Presentation,
  Store,
  Users,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { DemoBanner } from "@/components/dona/DemoBanner";
import AnimatedContent from "@/components/ui/AnimatedContent";
import FoldText from "@/components/ui/FoldText";
import { getConfig } from "@/lib/config";
import { DEMO_CODE } from "@/lib/seed";
import { loginLocal } from "@/lib/session";
import { ensureDemoSeedData, setCurrentSede, useDona } from "@/lib/store";
import { fetchPublicSedes } from "@/lib/sync";

const FALLBACK_DEMO_AFFILIATED = [
  { id: "caritas-boedo", name: "Cáritas Boedo – Parroquia Santa Cruz" },
  { id: "caritas-san-isidro", name: "Cáritas San Isidro" },
  { id: "caritas-quilmes", name: "Cáritas Quilmes" },
  { id: "caritas-moron", name: "Cáritas Morón" },
];

export default function OrgChoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { orgs, sedes } = useDona();
  const [selectedSedeId, setSelectedSedeId] = useState("caritas-boedo");
  const [demoLoading, setDemoLoading] = useState<"central" | "sede" | null>(null);

  const returnSlide = (() => {
    try {
      const fromQuery = searchParams.get("from") === "demo";
      const stored = sessionStorage.getItem("dona:demoReturnSlide");
      if (fromQuery) {
        return stored || "8";
      }
      return stored;
    } catch {
      return searchParams.get("from") === "demo" ? "8" : null;
    }
  })();

  useEffect(() => {
    if (searchParams.get("from") === "demo") {
      try {
        if (!sessionStorage.getItem("dona:demoReturnSlide")) {
          sessionStorage.setItem("dona:demoReturnSlide", "8");
        }
      } catch {
        // ignore storage errors
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (getConfig().sheetsEndpoint) {
      void fetchPublicSedes();
    }
  }, []);

  const primaryOrg = orgs[0] ?? null;
  const primaryOrgSedesCount = primaryOrg
    ? sedes.filter((s) => s.orgId === primaryOrg.id && s.active !== false).length
    : 0;
  const otherOrgs = orgs.slice(1);

  const demoAffiliatedOptions = useMemo(() => {
    const activeCaritas = sedes.filter(
      (s) => s.orgId === "caritas" && !s.isCentral && s.active !== false
    );
    if (activeCaritas.length > 0) {
      return activeCaritas.map((s) => ({ id: s.id, name: s.name }));
    }
    return FALLBACK_DEMO_AFFILIATED;
  }, [sedes]);

  const effectiveSedeId = demoAffiliatedOptions.some((s) => s.id === selectedSedeId)
    ? selectedSedeId
    : demoAffiliatedOptions[0]?.id ?? "caritas-boedo";

  const handleEnterDemoCentral = async () => {
    setDemoLoading("central");
    try {
      const { orgId } = ensureDemoSeedData();
      const res = await loginLocal("central", orgId, undefined, DEMO_CODE);
      if (!res.ok) {
        toast.error(res.error ?? "No pudimos abrir el modo demo central.");
        return;
      }
      navigate(`/central/${orgId}`);
    } finally {
      setDemoLoading(null);
    }
  };

  const handleEnterDemoSede = async () => {
    setDemoLoading("sede");
    try {
      const { orgId, affiliatedSedes } = ensureDemoSeedData();
      const targetSedeId = affiliatedSedes.some((s) => s.id === effectiveSedeId)
        ? effectiveSedeId
        : affiliatedSedes[0]?.id ?? "caritas-boedo";
      const res = await loginLocal("sede", orgId, targetSedeId, DEMO_CODE);
      if (!res.ok) {
        toast.error(res.error ?? "No pudimos abrir el modo demo afiliada.");
        return;
      }
      setCurrentSede(targetSedeId);
      navigate(`/sede/${targetSedeId}`);
    } finally {
      setDemoLoading(null);
    }
  };

  const clearReturnSlide = () => {
    try {
      sessionStorage.removeItem("dona:demoReturnSlide");
    } catch {
      // ignore
    }
  };

  return (
    <main
      className="relative flex min-h-svh w-full flex-col items-center justify-center bg-[#090d16] px-6 py-12 text-[#f8fafc]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 28%, rgba(56, 189, 248, 0.14), rgba(9, 13, 22, 0) 60%)",
      }}
    >
      <div className="w-full max-w-3xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#38bdf8]/25 bg-[#111827]/70 px-4 py-2 text-xs font-semibold text-[#cbd5e1] transition hover:border-[#38bdf8]/60 hover:text-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Volver</span>
          </Link>

          {returnSlide && (
            <Link
              to={`/demo?slide=${returnSlide}`}
              onClick={clearReturnSlide}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#38bdf8]/50 bg-[#0f172a] px-4 py-2 text-xs font-bold text-[#7dd3fc] transition hover:border-[#38bdf8] hover:text-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
            >
              <Presentation className="h-4 w-4 text-[#38bdf8]" aria-hidden="true" />
              <span>Volver a la presentación</span>
            </Link>
          )}
        </div>

        <header className="mb-8 text-center">
          <h1 className="tracking-tight">
            <FoldText
              text="Panel para organizaciones"
              foldStyle="paper"
              splitBy="char"
              hinge="top"
              trigger="mount"
              foldAngle={92}
              duration={0.65}
              stagger={0.035}
              staggerFrom="start"
              ease="power3.out"
              hoverRefold={true}
              refoldRadius={140}
              refoldAngle={45}
              perspective={700}
              creaseShading={0.55}
              fontSize="clamp(2rem, 5vw, 3.25rem)"
              fontWeight={800}
            />
          </h1>
          <AnimatedContent
            trigger="mount"
            distance={24}
            duration={0.65}
            ease="power3.out"
            blur={4}
            delay={0.15}
          >
            <p className="mt-3 text-sm text-[#94a3b8] sm:text-base">
              Sumá tu sede a una red existente o creá tu propia organización desde cero.
            </p>
          </AnimatedContent>
        </header>

        <DemoBanner className="mb-6" />

        <AnimatedContent
          trigger="mount"
          distance={48}
          duration={0.7}
          ease="power3.out"
          stagger={0.12}
          blur={4}
          delay={0.2}
          className="grid gap-5 sm:grid-cols-2"
        >
          <button
            type="button"
            disabled={!primaryOrg}
            onClick={() => primaryOrg && navigate(`/organizacion/${primaryOrg.id}/unirse`)}
            className="group flex flex-col justify-between rounded-3xl border border-[#38bdf8]/35 bg-[#111827]/85 p-6 text-left shadow-[0_12px_36px_rgba(0,0,0,0.4)] transition duration-200 hover:-translate-y-1 hover:border-[#38bdf8] hover:bg-[#1e293b]/90 hover:shadow-[0_18px_44px_rgba(56,189,248,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 cursor-pointer"
          >
            <div>
              <div className="mb-5 flex items-center justify-between">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#38bdf8]/15 text-[#38bdf8]">
                  <Users className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="rounded-full border border-[#38bdf8]/40 bg-[#38bdf8]/10 px-3 py-1 text-xs font-bold text-[#38bdf8]">
                  {primaryOrg
                    ? `${primaryOrgSedesCount} ${primaryOrgSedesCount === 1 ? "sede unida" : "sedes unidas"}`
                    : "Sin redes aún"}
                </span>
              </div>

              <h2 className="text-xl font-extrabold text-[#f8fafc]">
                Unirme a una organización
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#94a3b8]">
                {primaryOrg ? (
                  <>
                    Entrá con tu sede a{" "}
                    <strong className="text-[#f8fafc]">{primaryOrg.name}</strong>, o ingresá al
                    panel de Sede Central.
                  </>
                ) : (
                  "Todavía no hay organizaciones registradas en este dispositivo. Creá una nueva o conectá un Google Sheet existente."
                )}
              </p>
            </div>

            <div className="font-baskerville mt-6 flex items-center gap-2 text-sm font-bold text-[#38bdf8]">
              <span>
                {primaryOrg ? `Elegir ${primaryOrg.name}` : "Creá la primera organización al lado"}
              </span>
              {primaryOrg && (
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate("/organizacion/crear")}
            className="group flex flex-col justify-between rounded-3xl border border-slate-700/80 bg-[#111827]/80 p-6 text-left shadow-[0_12px_36px_rgba(0,0,0,0.4)] transition duration-200 hover:-translate-y-1 hover:border-[#38bdf8]/70 hover:bg-[#1e293b]/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] motion-reduce:transition-none motion-reduce:hover:translate-y-0 cursor-pointer"
          >
            <div>
              <div className="mb-5 flex items-center justify-between">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-[#f8fafc]">
                  <PlusCircle className="h-6 w-6 text-[#38bdf8]" aria-hidden="true" />
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-[#94a3b8]">
                  Nueva red u ONG
                </span>
              </div>

              <h2 className="text-xl font-extrabold text-[#f8fafc]">
                Crear una organización
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#94a3b8]">
                Configurá tu organización, su sede inicial y empezá a cargar donaciones con foto e inteligencia artificial.
              </p>
            </div>

            <div className="font-baskerville mt-6 flex items-center gap-2 text-sm font-bold text-[#f8fafc] group-hover:text-[#38bdf8]">
              <span>Registrar organización</span>
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </div>
          </button>
        </AnimatedContent>

        <section
          aria-labelledby="demo-mode-heading"
          className="mt-6 rounded-3xl border border-[#38bdf8]/35 bg-[#111827]/85 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.4)] sm:p-6"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2
              id="demo-mode-heading"
              className="flex items-center gap-2 text-base font-extrabold text-[#f8fafc] sm:text-lg"
            >
              <Presentation className="h-5 w-5 text-[#38bdf8]" aria-hidden="true" />
              <span>Modo demo · Ver plataforma sin código</span>
            </h2>
            <span className="rounded-full border border-[#38bdf8]/35 bg-[#0f172a] px-3 py-1 text-xs font-bold text-[#7dd3fc]">
              Red Cáritas de ejemplo
            </span>
          </div>

          <p className="mb-4 text-sm text-[#cbd5e1]">
            Elegí cómo querés recorrer el sistema en vivo con datos precargados (sin afectar
            planillas reales):
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col justify-between rounded-2xl border border-slate-700/80 bg-[#090d16]/90 p-4">
              <div>
                <div className="flex items-center gap-2 text-[#38bdf8]">
                  <BarChart3 className="h-5 w-5" aria-hidden="true" />
                  <h3 className="text-base font-bold text-[#f8fafc]">Sede Central (Red)</h3>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-[#cbd5e1]">
                  Tablero Business Intelligence, conteo de sedes afiliadas, alertas y stock
                  consolidado de toda la organización.
                </p>
              </div>
              <button
                type="button"
                disabled={demoLoading !== null}
                onClick={() => void handleEnterDemoCentral()}
                className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-[#38bdf8] px-4 py-2.5 text-sm font-extrabold text-[#090d16] transition hover:bg-[#56ccf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] disabled:opacity-60 cursor-pointer"
              >
                <span>Ver como Sede Central</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-slate-700/80 bg-[#090d16]/90 p-4">
              <div>
                <div className="flex items-center gap-2 text-[#7dd3fc]">
                  <Store className="h-5 w-5" aria-hidden="true" />
                  <h3 className="text-base font-bold text-[#f8fafc]">Sede Afiliada (Local)</h3>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-[#cbd5e1]">
                  Carga rápida con foto + Gemini IA, origen de cada donación y gestión de stock
                  local de la sede.
                </p>
                <div className="mt-3">
                  <label
                    htmlFor="demo-sede-select"
                    className="mb-1 block text-xs font-semibold text-[#cbd5e1]"
                  >
                    Elegí una sede afiliada
                  </label>
                  <select
                    id="demo-sede-select"
                    value={effectiveSedeId}
                    onChange={(e) => setSelectedSedeId(e.target.value)}
                    className="min-h-[40px] w-full rounded-xl border border-slate-700 bg-[#0f172a] px-3 py-2 text-xs font-semibold text-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
                  >
                    {demoAffiliatedOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                disabled={demoLoading !== null}
                onClick={() => void handleEnterDemoSede()}
                className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-[#38bdf8]/60 bg-[#0f172a] px-4 py-2.5 text-sm font-extrabold text-[#f8fafc] transition hover:border-[#38bdf8] hover:bg-[#1e293b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] disabled:opacity-60 cursor-pointer"
              >
                <span>Entrar como Sede Afiliada</span>
                <ArrowRight className="h-4 w-4 text-[#38bdf8]" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        {otherOrgs.length > 0 && (
          <AnimatedContent
            trigger="mount"
            distance={36}
            duration={0.65}
            ease="power3.out"
            delay={0.35}
            blur={3}
          >
            <section className="mt-8 rounded-2xl border border-slate-800 bg-[#111827]/70 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#94a3b8]">
                <Building2 className="h-4 w-4 text-[#38bdf8]" aria-hidden="true" />
                Otras organizaciones disponibles
              </h3>
              <div className="flex flex-wrap gap-2">
                {otherOrgs.map((org) => {
                  const count = sedes.filter((s) => s.orgId === org.id && s.active !== false).length;
                  return (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() => navigate(`/organizacion/${org.id}/unirse`)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-[#f8fafc] transition hover:border-[#38bdf8] cursor-pointer"
                    >
                      <span>{org.name}</span>
                      <span className="text-[#38bdf8]">
                        ({count} {count === 1 ? "sede" : "sedes"})
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </AnimatedContent>
        )}
      </div>
    </main>
  );
}
