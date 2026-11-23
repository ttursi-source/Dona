import { useEffect, useState } from "react";
import {
  Building2,
  Camera,
  CheckCircle2,
  FileSpreadsheet,
  LayoutDashboard,
  Package,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CaptureFlow } from "@/components/dona/CaptureFlow";
import { DonorsPanel } from "@/components/dona/DonorsPanel";
import { InventoryTable } from "@/components/dona/InventoryTable";
import { SheetPanel } from "@/components/dona/SheetPanel";
import { WorkspaceShell, type WorkspaceViewDef } from "@/components/dona/WorkspaceShell";
import { DeviceChart, Metric, Panel, StackChart } from "@/components/ui/glassy-dashboard";
import {
  computeCategoryMix,
  computeIntakeBuckets,
  computeSummary,
  computeTopTags,
  periodToDays,
} from "@/lib/analytics";
import { signOut } from "@/lib/session";
import { scheduleSync } from "@/lib/sync";
import { deleteItem, markDelivered, setCurrentSede, useDona } from "@/lib/store";
import type { InventoryItem, PeriodOption } from "@/lib/types";

type SedeView = "resumen" | "cargar" | "inventario" | "donantes" | "planilla";

const SEDE_VIEWS: readonly WorkspaceViewDef<SedeView>[] = [
  {
    id: "resumen",
    label: "Resumen",
    short: "Resumen",
    icon: LayoutDashboard,
    description: "Stock actual, ingresos recientes y categorías principales de tu sede.",
    prompt: "¿Cómo viene el stock de esta sede?",
  },
  {
    id: "cargar",
    label: "Cargar donación",
    short: "Cargar",
    icon: Camera,
    description: "Sacá una foto, etiquetá en segundos y registrá quién lo donó.",
    prompt: "Cargar una donación con foto.",
  },
  {
    id: "inventario",
    label: "Inventario",
    short: "Stock",
    icon: Package,
    description: "Buscá productos, filtrá por categoría o marcá entregas.",
    prompt: "Buscar productos o exportar CSV.",
  },
  {
    id: "donantes",
    label: "Donantes",
    short: "Donantes",
    icon: Users,
    description: "Empresas, comercios y organizaciones que aportan a esta sede.",
    prompt: "Ver organizaciones donantes.",
  },
  {
    id: "planilla",
    label: "Planilla y Drive",
    short: "Planilla",
    icon: FileSpreadsheet,
    description: "Conectá Google Sheets, Drive y la API gratuita de Gemini.",
    prompt: "Abrir o sincronizar Google Sheets.",
  },
];

const PERIODS: PeriodOption[] = ["7 días", "30 días", "90 días"];

export default function SedeWorkspace() {
  const { sedeId } = useParams<{ sedeId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [period, setPeriod] = useState<PeriodOption>("30 días");

  const { orgs, sedes, donors, items } = useDona();

  const sede = sedes.find((s) => s.id === sedeId);
  const org = sede ? orgs.find((o) => o.id === sede.orgId) : undefined;

  useEffect(() => {
    if (sede && !sede.isCentral) {
      setCurrentSede(sede.id);
    }
  }, [sede]);

  if (!sede || !org) {
    return <Navigate to="/organizacion" replace />;
  }

  if (sede.isCentral) {
    return <Navigate to={`/central/${org.id}`} replace />;
  }

  const rawView = searchParams.get("v") as SedeView | null;
  const activeView: SedeView = SEDE_VIEWS.some((v) => v.id === rawView) ? rawView! : "resumen";

  const selectView = (v: SedeView) => {
    setSearchParams({ v }, { replace: true });
  };

  const orgSedes = sedes.filter((s) => s.orgId === org.id);
  const orgDonors = donors.filter((d) => d.orgId === org.id);
  const sedeItems = items.filter((i) => i.sedeId === sede.id);

  const days = periodToDays(period);
  const summary = computeSummary(sedeItems, orgDonors, [sede], days);
  const buckets = computeIntakeBuckets(sedeItems, days);
  const catMix = computeCategoryMix(sedeItems);
  const topTags = computeTopTags(sedeItems, 14);

  const handleMarkDelivered = (item: InventoryItem) => {
    const updated = markDelivered(item.id);
    toast.success(`"${item.name}" marcado como entregado`);
    if (updated) {
      scheduleSync();
    }
  };

  const handleDelete = (item: InventoryItem) => {
    deleteItem(item.id);
    toast.success(`"${item.name}" eliminado`);
    scheduleSync();
  };

  const headActions =
    activeView === "resumen" ? (
      <>
        <div className="gd-period" role="group" aria-label="Período de análisis">
          {PERIODS.map((p) => (
            <button
              type="button"
              key={p}
              aria-pressed={p === period}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="gd-primary"
          onClick={() => selectView("cargar")}
        >
          <Plus aria-hidden="true" />
          <span>Cargar donación</span>
        </button>
      </>
    ) : undefined;

  return (
    <WorkspaceShell
      orgName={org.name}
      sedeName={`${sede.name} · ${sede.locality}`}
      views={SEDE_VIEWS}
      activeView={activeView}
      onSelectView={selectView}
      onExit={() => {
        signOut();
        navigate("/organizacion");
      }}
      headActions={headActions}
      extraHeaderAction={
        <button
          type="button"
          className="dn-exit-btn"
          onClick={() => navigate(`/central/${org.id}`)}
          title="Ir a Sede Central"
        >
          <Building2 aria-hidden="true" />
          <span>Sede Central</span>
        </button>
      }
      footerLeft={`${sede.name} · ${org.name}`}
      animationDeps={[period, sedeItems.length]}
    >
      {activeView === "resumen" && (
        <div className="gd-analytics">
          <div className="gd-metric-grid">
            <Metric
              title="Stock disponible"
              icon={<Package />}
              value={summary.stockUnits}
              detail={`en ${summary.stockLots} lotes activos`}
              tone="teal"
            />
            <Metric
              title="Ingresos del período"
              icon={<TrendingUp />}
              value={summary.intakeUnits}
              detail={`en ${summary.intakeLots} ingresos (${period})`}
            />
            <Metric
              title="Entregados"
              icon={<CheckCircle2 />}
              value={summary.deliveredUnits}
              detail={`en ${summary.deliveredLots} entregas (${period})`}
            />
            <Metric
              title="Donantes activos"
              icon={<Users />}
              value={summary.activeDonors}
              detail="empresas u organizaciones"
            />
          </div>

          <div className="gd-analytics-grid">
            <Panel
              title="Ingresos por fecha"
              subtitle={`Unidades recibidas en los últimos ${period}: particulares vs. organizaciones`}
            >
              <StackChart
                items={buckets}
                labels={["Particulares", "Organizaciones"]}
                tones={["ink", "teal"]}
                format={(v) => `${Math.round(v)} u.`}
                title="Ingresos por fecha y tipo de donante"
              />
            </Panel>

            <Panel title="Stock por categoría" className="gd-device-panel">
              <DeviceChart
                mix={catMix.mix}
                visitors={catMix.totalUnits}
                labels={catMix.labels}
                tones={catMix.tones}
                totalLabel="Unidades"
              />
            </Panel>
          </div>

          <Panel
            title="Etiquetas más frecuentes en stock"
            subtitle="Generadas automáticamente o cargadas por voluntarios para ubicar recursos rápido."
            action={
              <button
                type="button"
                className="gd-primary"
                onClick={() => selectView("cargar")}
              >
                <Camera aria-hidden="true" />
                <span>Sacar foto y cargar</span>
              </button>
            }
          >
            {topTags.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {topTags.map((t) => (
                  <button
                    key={t.tag}
                    type="button"
                    className="dn-chip dn-chip-btn"
                    onClick={() => selectView("inventario")}
                  >
                    <span>#{t.tag}</span>
                    <strong style={{ color: "var(--gd-teal)" }}>{t.units} u.</strong>
                  </button>
                ))}
              </div>
            ) : (
              <p className="gd-empty">
                Todavía no hay donaciones en stock. Tocá &ldquo;Cargar donación&rdquo; para sumar la primera.
              </p>
            )}
          </Panel>
        </div>
      )}

      {activeView === "cargar" && (
        <CaptureFlow
          orgId={org.id}
          sedeId={sede.id}
          donors={orgDonors}
          onSaved={() => {
            // Keep volunteer in Cargar so batch scanning works effortlessly
          }}
        />
      )}

      {activeView === "inventario" && (
        <InventoryTable
          items={sedeItems}
          donors={orgDonors}
          sedes={orgSedes}
          onMarkDelivered={handleMarkDelivered}
          onDelete={handleDelete}
          exportFilename={`inventario-${sede.id}.csv`}
        />
      )}

      {activeView === "donantes" && (
        <DonorsPanel
          orgId={org.id}
          donors={orgDonors}
          items={sedeItems}
          sedes={orgSedes}
        />
      )}

      {activeView === "planilla" && (
        <SheetPanel
          items={sedeItems}
          donors={orgDonors}
          sedes={orgSedes}
        />
      )}
    </WorkspaceShell>
  );
}
