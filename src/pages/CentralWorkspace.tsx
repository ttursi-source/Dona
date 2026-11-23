import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Building2,
  FileSpreadsheet,
  KeyRound,
  LayoutDashboard,
  Package,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  TrendingUp,
  Users,
} from "lucide-react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { DonorsPanel } from "@/components/dona/DonorsPanel";
import { PhotoLightbox } from "@/components/dona/PhotoLightbox";
import { SaveCodeDialog } from "@/components/dona/SaveCodeDialog";
import { SheetPanel } from "@/components/dona/SheetPanel";
import { WorkspaceShell, type WorkspaceViewDef } from "@/components/dona/WorkspaceShell";
import ChromaGrid from "@/components/ui/ChromaGrid";
import {
  Badge,
  DeviceChart,
  Metric,
  Panel,
  StackChart,
  saveCsv,
} from "@/components/ui/glassy-dashboard";
import { generateCode } from "@/lib/access";
import {
  computeAlerts,
  computeCategoryMix,
  computeIntakeBuckets,
  computeSedeMetrics,
  computeSummary,
  computeTopTags,
  periodToDays,
} from "@/lib/analytics";
import { signOut } from "@/lib/session";
import { clearDemoData, deactivateSede, useDona } from "@/lib/store";
import { rotateCodeRemote, scheduleSync } from "@/lib/sync";
import { CATEGORIES, type PeriodOption } from "@/lib/types";

type CentralView = "panorama" | "sedes" | "recursos" | "donantes" | "planilla";

const CENTRAL_VIEWS: readonly WorkspaceViewDef<CentralView>[] = [
  {
    id: "panorama",
    label: "Panorama",
    short: "Panorama",
    icon: LayoutDashboard,
    description: "Visión consolidada de todas las sedes, stock total, ingresos y alertas.",
    prompt: "¿Cómo está toda la red hoy?",
  },
  {
    id: "sedes",
    label: "Sedes unidas",
    short: "Sedes",
    icon: Building2,
    description: "Comparativa por sede: stock disponible, movimientos y estado de carga.",
    prompt: "Ver sedes activas e inactivas.",
  },
  {
    id: "recursos",
    label: "Recursos y Tags",
    short: "Recursos",
    icon: Package,
    description: "Buscá por etiqueta o categoría dónde hay stock para redistribuir.",
    prompt: "¿Dónde hay abrigos, fideos o pañales?",
  },
  {
    id: "donantes",
    label: "Donantes",
    short: "Donantes",
    icon: Users,
    description: "Ranking de empresas y organizaciones donantes en toda la red.",
    prompt: "Ver aportes de empresas en la red.",
  },
  {
    id: "planilla",
    label: "Planilla y Drive",
    short: "Planilla",
    icon: FileSpreadsheet,
    description: "Hoja consolidada en Google Sheets, fotos en Drive y datos de prueba.",
    prompt: "Abrir planilla general o limpiar demo.",
  },
];

const PERIODS: PeriodOption[] = ["7 días", "30 días", "90 días"];

export default function CentralWorkspace() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [period, setPeriod] = useState<PeriodOption>("30 días");
  const [resourceQuery, setResourceQuery] = useState("");
  const [resourceCat, setResourceCat] = useState("Todas");
  const [previewItem, setPreviewItem] = useState<(typeof items)[number] | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [rotatedCodeModal, setRotatedCodeModal] = useState<{
    code: string;
    targetName: string;
  } | null>(null);

  const { orgs, sedes, donors, items } = useDona();
  const org = orgs.find((o) => o.id === orgId);

  const orgSedes = useMemo(() => sedes.filter((s) => s.orgId === orgId), [sedes, orgId]);
  const operationalSedesCount = useMemo(
    () => orgSedes.filter((s) => !s.isCentral && s.active !== false).length,
    [orgSedes]
  );
  const orgDonors = useMemo(() => donors.filter((d) => d.orgId === orgId), [donors, orgId]);
  const orgItems = useMemo(() => items.filter((i) => i.orgId === orgId), [items, orgId]);

  const rawView = searchParams.get("v") as CentralView | null;
  const activeView: CentralView = CENTRAL_VIEWS.some((v) => v.id === rawView)
    ? rawView!
    : "panorama";

  const selectView = (v: CentralView) => {
    setSearchParams({ v }, { replace: true });
  };

  const days = periodToDays(period);
  const summary = computeSummary(orgItems, orgDonors, orgSedes, days);
  const buckets = computeIntakeBuckets(orgItems, days);
  const catMix = computeCategoryMix(orgItems);
  const topTags = computeTopTags(orgItems, 15);
  const sedeRows = computeSedeMetrics(orgSedes, orgItems, days);
  const alerts = computeAlerts(orgSedes, orgItems);

  const resourceMatchesBySede = useMemo(() => {
    const q = resourceQuery.trim().toLowerCase();
    const available = orgItems.filter((i) => {
      if (i.status !== "disponible") return false;
      if (resourceCat !== "Todas" && i.category !== resourceCat) return false;
      if (!q) return true;
      return [i.name, i.category, ...i.tags].join(" ").toLowerCase().includes(q);
    });

    const grouped = new Map<
      string,
      { units: number; lots: number; samples: string[] }
    >();
    for (const item of available) {
      const cur = grouped.get(item.sedeId) ?? { units: 0, lots: 0, samples: [] };
      cur.units += item.quantity;
      cur.lots += 1;
      if (!cur.samples.includes(item.name) && cur.samples.length < 3) {
        cur.samples.push(item.name);
      }
      grouped.set(item.sedeId, cur);
    }

    return orgSedes
      .filter((s) => !s.isCentral || grouped.has(s.id))
      .map((s) => {
        const g = grouped.get(s.id) ?? { units: 0, lots: 0, samples: [] };
        return { sede: s, ...g };
      })
      .sort((a, b) => b.units - a.units);
  }, [orgItems, orgSedes, resourceQuery, resourceCat]);

  const sedeMap = useMemo(() => new Map(orgSedes.map((s) => [s.id, s.name])), [orgSedes]);
  const donorMap = useMemo(() => new Map(orgDonors.map((d) => [d.id, d.name])), [orgDonors]);
  const photoItems = useMemo(
    () => orgItems.filter((i) => Boolean(i.photoThumb || i.photoUrl)),
    [orgItems]
  );

  if (!org) {
    return <Navigate to="/organizacion" replace />;
  }

  const exportNetworkCsv = () => {
    saveCsv(`central-${org.id}-sedes.csv`, [
      ["Sede", "Localidad", "Stock disponible", `Ingresos (${period})`, `Entregados (${period})`, "Última carga", "Alertas"],
      ...sedeRows.map((r) => [
        r.sede.name,
        r.sede.locality,
        r.stockUnits,
        r.intakeUnits,
        r.deliveredUnits,
        r.lastLoadAt ? new Date(r.lastLoadAt).toLocaleDateString("es-AR") : "Sin cargas",
        r.alerts.join(" | "),
      ]),
    ]);
  };

  const headActions =
    activeView === "panorama" || activeView === "sedes" ? (
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
        <button type="button" className="gd-primary gd-export" onClick={exportNetworkCsv}>
          <ArrowDownToLine aria-hidden="true" />
          <span>Exportar CSV</span>
        </button>
      </>
    ) : undefined;

  const handleRotateCode = async (
    targetType: "sede" | "central",
    targetId: string,
    targetName: string
  ) => {
    if (!org || rotatingId) return;
    setRotatingId(targetId);
    try {
      const newCode = generateCode();
      const res = await rotateCodeRemote({
        orgId: org.id,
        targetType,
        targetId,
        newCode,
      });
      if (!res.ok) {
        toast.error(res.error || "No se pudo rotar el código");
        return;
      }
      setRotatedCodeModal({ code: newCode, targetName });
    } finally {
      setRotatingId(null);
    }
  };

  const handleDeactivateSede = (sedeId: string, sedeName: string) => {
    if (
      !window.confirm(
        `¿Dar de baja "${sedeName}"? Su historial de entregas e ítems se conserva, pero la sede ya no podrá operar ni ingresar.`
      )
    ) {
      return;
    }
    deactivateSede(sedeId);
    scheduleSync(200);
    toast.success(`"${sedeName}" dada de baja`);
  };

  const managedSedeRows = useMemo(() => {
    const metricMap = new Map(sedeRows.map((r) => [r.sede.id, r]));
    return orgSedes
      .filter((s) => !s.isCentral)
      .map(
        (sede) =>
          metricMap.get(sede.id) ?? {
            sede,
            stockUnits: 0,
            stockLots: 0,
            intakeUnits: 0,
            deliveredUnits: 0,
            lastLoadAt: null,
            topCategories: [],
            alerts: [],
          }
      )
      .sort((a, b) => Number(b.sede.active !== false) - Number(a.sede.active !== false) || b.stockUnits - a.stockUnits);
  }, [orgSedes, sedeRows]);

  return (
    <>
      <WorkspaceShell
        orgName={org.name}
        sedeName={`Sede Central · ${operationalSedesCount} activas`}
        views={CENTRAL_VIEWS}
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
            onClick={() => navigate(`/organizacion/${org.id}/unirse`)}
          >
            <Plus aria-hidden="true" />
            <span>Sedes ({operationalSedesCount})</span>
          </button>
        }
        footerLeft={`Sede Central · ${org.name}`}
        animationDeps={[period, orgItems.length, orgSedes.length]}
      >
        {activeView === "panorama" && (
          <div className="gd-analytics">
            <div className="gd-metric-grid">
              <Metric
                title="Sedes activas"
                icon={<Building2 />}
                value={operationalSedesCount}
                detail={`${summary.activeSedes} con ingresos en ${period}`}
                tone="teal"
              />
            <Metric
              title="Stock total"
              icon={<Package />}
              value={summary.stockUnits}
              detail={`en ${summary.stockLots} lotes disponibles`}
            />
            <Metric
              title="Ingresos del período"
              icon={<TrendingUp />}
              value={summary.intakeUnits}
              detail={`${summary.deliveredUnits} u. entregadas`}
            />
            <Metric
              title="Donantes empresa"
              icon={<Users />}
              value={orgDonors.length}
              detail="organizaciones registradas"
            />
          </div>

          <div className="gd-analytics-grid">
            <Panel
              title="Ingresos en toda la red"
              subtitle={`Comparación de donaciones particulares vs. organizaciones (${period})`}
            >
              <StackChart
                items={buckets}
                labels={["Particulares", "Organizaciones"]}
                tones={["ink", "teal"]}
                format={(v) => `${Math.round(v)} u.`}
                title="Ingresos consolidados por período"
              />
            </Panel>

            <Panel title="Mix por categoría" className="gd-device-panel">
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
            title={`Alertas operativas (${alerts.length})`}
            subtitle="Sedes sin carga reciente (+14 días), perecederos por vencer o faltantes críticos."
          >
            {alerts.length > 0 ? (
              <div style={{ display: "grid", gap: 8 }}>
                {alerts.slice(0, 8).map((a) => (
                  <div key={a.id} className="dn-alert-card" data-severity={a.severity}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <TriangleAlert
                        style={{
                          width: 17,
                          height: 17,
                          marginTop: 2,
                          color: a.severity === "alta" ? "var(--gd-coral)" : "var(--gd-ochre)",
                        }}
                        aria-hidden="true"
                      />
                      <div>
                        <strong style={{ display: "block", fontSize: 12.5 }}>{a.title}</strong>
                        <span style={{ fontSize: 11.5, color: "var(--gd-muted)" }}>{a.detail}</span>
                      </div>
                    </div>
                    {a.sedeId && (
                      <button
                        type="button"
                        className="gd-secondary"
                        style={{ minBlockSize: 34, padding: "5px 12px", fontSize: 11 }}
                        onClick={() => navigate(`/sede/${a.sedeId}`)}
                      >
                        <span>Ver sede</span>
                        <ArrowRight aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="gd-empty">Todas las sedes están activas y sin alertas críticas.</p>
            )}
          </Panel>
        </div>
      )}

      {activeView === "sedes" && (
        <div className="gd-analytics">
          <Panel
            title={`Sedes de ${org.name} (${operationalSedesCount} activas · ${managedSedeRows.length} registradas)`}
            subtitle="Gestioná accesos, rotá códigos o entrá al inventario particular de cada sede."
            action={
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button
                  type="button"
                  className="gd-secondary"
                  disabled={rotatingId !== null}
                  onClick={() =>
                    void handleRotateCode("central", org.id, `Sede Central · ${org.name}`)
                  }
                >
                  <KeyRound aria-hidden="true" />
                  <span>Rotar código Central</span>
                </button>
                <button
                  type="button"
                  className="gd-primary"
                  onClick={() => navigate(`/organizacion/${org.id}/unirse`)}
                >
                  <Plus aria-hidden="true" />
                  <span>Sumar otra sede</span>
                </button>
              </div>
            }
          >
            <div className="gd-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Sede</th>
                    <th scope="col">Localidad</th>
                    <th scope="col">Stock disp.</th>
                    <th scope="col">Ingresos</th>
                    <th scope="col">Última carga</th>
                    <th scope="col">Top categorías</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {managedSedeRows.map((row) => {
                    const isActive = row.sede.active !== false;
                    return (
                      <tr key={row.sede.id} style={isActive ? undefined : { opacity: 0.68 }}>
                        <td>{row.sede.name}</td>
                        <td>{row.sede.locality}</td>
                        <td>
                          <strong>{row.stockUnits}</strong> u. ({row.stockLots} lotes)
                        </td>
                        <td>{row.intakeUnits} u.</td>
                        <td>
                          {row.lastLoadAt
                            ? new Date(row.lastLoadAt).toLocaleDateString("es-AR")
                            : "Sin cargas"}
                        </td>
                        <td>
                          {row.topCategories.length > 0 ? row.topCategories.join(", ") : "—"}
                        </td>
                        <td>
                          {!isActive ? (
                            <Badge status="De baja" />
                          ) : row.alerts.length > 0 ? (
                            <Badge status="Pendiente" />
                          ) : (
                            <Badge status="Disponible" />
                          )}
                        </td>
                        <td>
                          {isActive ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              <button
                                type="button"
                                className="gd-secondary"
                                style={{ minBlockSize: 32, padding: "4px 10px", fontSize: 11.5 }}
                                onClick={() => navigate(`/sede/${row.sede.id}`)}
                              >
                                <span>Ver sede</span>
                                <ArrowRight aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className="gd-secondary"
                                disabled={rotatingId !== null}
                                style={{ minBlockSize: 32, padding: "4px 10px", fontSize: 11.5 }}
                                onClick={() =>
                                  void handleRotateCode("sede", row.sede.id, row.sede.name)
                                }
                              >
                                <KeyRound aria-hidden="true" />
                                <span>Nuevo código</span>
                              </button>
                              <button
                                type="button"
                                className="gd-secondary"
                                style={{ minBlockSize: 32, padding: "4px 10px", fontSize: 11.5 }}
                                onClick={() => handleDeactivateSede(row.sede.id, row.sede.name)}
                              >
                                <Trash2 aria-hidden="true" />
                                <span>Dar de baja</span>
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: "var(--gd-muted)" }}>
                              Sede inactiva
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {managedSedeRows.length === 0 && (
              <p className="gd-empty">
                Todavía no se unieron sedes operativas a esta organización.
              </p>
            )}
          </Panel>
        </div>
      )}

      {activeView === "recursos" && (
        <div className="gd-analytics">
          <Panel
            title="Etiquetas más frecuentes en toda la red"
            subtitle="Tocá cualquier etiqueta para ver en qué sedes hay stock disponible y redistribuir."
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
              {topTags.map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  className={`dn-chip dn-chip-btn ${
                    resourceQuery.toLowerCase() === t.tag ? "dn-chip-active" : ""
                  }`}
                  onClick={() =>
                    setResourceQuery((prev) => (prev.toLowerCase() === t.tag ? "" : t.tag))
                  }
                >
                  <span>#{t.tag}</span>
                  <span>{t.units} u.</span>
                </button>
              ))}
              {topTags.length === 0 && (
                <span className="gd-empty">Sin etiquetas registradas aún.</span>
              )}
            </div>

            <div className="gd-table-tools">
              <label className="gd-search" style={{ minInlineSize: 220 }}>
                <Search aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Buscar tag o producto (ej: pañales, campera)"
                  aria-label="Buscar recurso por tag o nombre"
                  value={resourceQuery}
                  onChange={(e) => setResourceQuery(e.target.value)}
                />
              </label>
              <label className="gd-filter">
                <select
                  aria-label="Filtrar por categoría"
                  value={resourceCat}
                  onChange={(e) => setResourceCat(e.target.value)}
                >
                  <option value="Todas">Todas las categorías</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              {(resourceQuery || resourceCat !== "Todas") && (
                <button
                  type="button"
                  className="gd-secondary"
                  onClick={() => {
                    setResourceQuery("");
                    setResourceCat("Todas");
                  }}
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </Panel>

          <Panel
            title="Disponibilidad por sede (dónde hay qué)"
            subtitle="Compará rápido qué sede tiene stock para cubrir pedidos o derivar recursos."
          >
            <div className="gd-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Sede</th>
                    <th scope="col">Localidad</th>
                    <th scope="col">Unidades disp.</th>
                    <th scope="col">Lotes</th>
                    <th scope="col">Ejemplos encontrados</th>
                    <th scope="col">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {resourceMatchesBySede.map((row) => (
                    <tr key={row.sede.id}>
                      <td>{row.sede.name}</td>
                      <td>{row.sede.locality}</td>
                      <td>
                        <strong>{row.units}</strong>
                      </td>
                      <td>{row.lots}</td>
                      <td>{row.samples.length > 0 ? row.samples.join(", ") : "Sin coincidencias"}</td>
                      <td>
                        <button
                          type="button"
                          className="gd-secondary"
                          style={{ minBlockSize: 32, padding: "4px 10px", fontSize: 11 }}
                          onClick={() => navigate(`/sede/${row.sede.id}`)}
                        >
                          <span>Ir a sede</span>
                          <ArrowRight aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel
            title={`Fotos cargadas por las sedes (${photoItems.length})`}
            subtitle="Hacé clic en cualquier foto para ver el detalle completo, sede y vínculo a Google Drive."
          >
            {photoItems.length > 0 ? (
              <ChromaGrid
                items={photoItems.map((item) => ({
                  image: (item.photoThumb || item.photoUrl)!,
                  title: item.name,
                  subtitle: `${sedeMap.get(item.sedeId) ?? item.sedeId} · ${item.quantity} ${item.unit}`,
                  accent: "#38bdf8",
                  onClick: () => setPreviewItem(item),
                }))}
                columns={4}
                minCardWidth={170}
                reveal="card"
                grayscale={0}
                dim={0}
                theme="dark"
              />
            ) : (
              <p className="gd-empty">
                Todavía no hay fotos cargadas por las sedes. Cuando un voluntario suba una donación con foto desde cualquier sede, va a aparecer acá.
              </p>
            )}
          </Panel>

          <PhotoLightbox
            item={previewItem}
            sedeName={previewItem ? sedeMap.get(previewItem.sedeId) : undefined}
            donorName={
              previewItem?.donorId
                ? donorMap.get(previewItem.donorId) ?? "Organización"
                : "Particular"
            }
            onClose={() => setPreviewItem(null)}
          />
        </div>
      )}

      {activeView === "donantes" && (
        <DonorsPanel
          orgId={org.id}
          donors={orgDonors}
          items={orgItems}
          sedes={orgSedes}
          showSedes
        />
      )}

      {activeView === "planilla" && (
        <SheetPanel
          items={orgItems}
          donors={orgDonors}
          sedes={orgSedes}
          onClearDemo={clearDemoData}
        />
      )}
      </WorkspaceShell>

      {rotatedCodeModal && (
        <SaveCodeDialog
          open={Boolean(rotatedCodeModal)}
          title="Nuevo código generado"
          subtitle="El código anterior dejó de funcionar de inmediato."
          code={rotatedCodeModal.code}
          targetName={rotatedCodeModal.targetName}
          buttonLabel="Listo, ya lo guardé"
          onConfirm={() => setRotatedCodeModal(null)}
        />
      )}
    </>
  );
}
