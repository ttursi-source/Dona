import { useState, type FormEvent } from "react";
import {
  Activity,
  ArrowDownToLine,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge, Panel, saveCsv } from "@/components/ui/glassy-dashboard";
import { getConfig, isValidEndpointUrl, setConfig, toEmbedSheetUrl } from "@/lib/config";
import { pingBackend, refreshSyncStatus, syncNow, useSyncStatus } from "@/lib/sync";
import type { Donor, InventoryItem, Sede } from "@/lib/types";

interface SheetPanelProps {
  items: InventoryItem[];
  donors: Donor[];
  sedes: Sede[];
  onClearDemo?: () => void;
}

export function SheetPanel({ items, donors, sedes, onClearDemo }: SheetPanelProps) {
  const initial = getConfig();
  const [sheetsEndpoint, setSheetsEndpoint] = useState(initial.sheetsEndpoint);
  const [sheetUrl, setSheetUrl] = useState(initial.sheetUrl);
  const [geminiKey, setGeminiKey] = useState(initial.geminiKey);
  const [showKey, setShowKey] = useState(false);

  const syncStatus = useSyncStatus();
  const [testing, setTesting] = useState(false);
  const [pingResult, setPingResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [showPreviewRows, setShowPreviewRows] = useState(false);

  const connected = Boolean(sheetsEndpoint.trim());
  const embedUrl = toEmbedSheetUrl(sheetUrl);

  const donorMap = new Map(donors.map((d) => [d.id, d.name]));
  const sedeMap = new Map(sedes.map((s) => [s.id, s.name]));

  const handleSaveConfig = (e: FormEvent) => {
    e.preventDefault();
    const cleanEp = sheetsEndpoint.trim();
    if (cleanEp && !isValidEndpointUrl(cleanEp)) {
      toast.error("La URL de Apps Script debe comenzar con https:// (o localhost en pruebas).");
      return;
    }
    setConfig({ sheetsEndpoint: cleanEp, sheetUrl, geminiKey });
    refreshSyncStatus();
    toast.success("Configuración guardada en este dispositivo");
  };

  const handleTestConnection = async () => {
    const cleanEp = sheetsEndpoint.trim();
    if (!cleanEp) {
      toast.error("Primero pegá la URL de Apps Script (/exec).");
      return;
    }
    if (!isValidEndpointUrl(cleanEp)) {
      toast.error("URL de endpoint inválida.");
      return;
    }
    setTesting(true);
    try {
      const res = await pingBackend(cleanEp);
      if (!res.ok) {
        setPingResult({ ok: false, message: res.error || "No se pudo conectar" });
        toast.error(res.error || "No se pudo conectar con Apps Script");
        return;
      }
      const aiMsg = res.hasGeminiKey ? "IA configurada en servidor" : "sin GEMINI_API_KEY en servidor";
      const message = `Conectado (${res.latencyMs ?? 0} ms · v${res.version ?? 2} · ${aiMsg})`;
      setPingResult({ ok: true, message });
      toast.success(message);
    } finally {
      setTesting(false);
    }
  };

  const handleSyncPending = async () => {
    if (!connected) {
      toast.error("Primero pegá el endpoint de Apps Script (/exec).");
      return;
    }
    const res = await syncNow();
    if (res.ok) {
      toast.success("Planilla y Drive sincronizados al día");
    } else if (!res.skipped) {
      toast.error(res.error ?? "No se pudo sincronizar con Google Sheets");
    } else {
      toast.info("Iniciá sesión con tu código de acceso para sincronizar");
    }
  };

  const handleCopyInviteLink = async () => {
    const cleanEp = sheetsEndpoint.trim();
    if (!cleanEp || !isValidEndpointUrl(cleanEp)) {
      toast.error("Guardá un endpoint válido de Apps Script para generar el enlace.");
      return;
    }
    const base = import.meta.env.BASE_URL || "/";
    const normalizedBase = base.endsWith("/") ? base : `${base}/`;
    const inviteUrl = `${window.location.origin}${normalizedBase}#/organizacion?ep=${encodeURIComponent(
      cleanEp
    )}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Enlace de invitación copiado para compartir con voluntarios");
    } catch {
      toast.info(inviteUrl);
    }
  };

  const handleExportAll = () => {
    saveCsv("dona-inventario-completo.csv", [
      [
        "ID",
        "Fecha",
        "Sede",
        "Producto",
        "Categoría",
        "Etiquetas",
        "Cantidad",
        "Unidad",
        "Estado",
        "Donante",
        "Foto Drive",
        "Stock",
      ],
      ...items.map((i) => [
        i.id,
        i.createdAt,
        sedeMap.get(i.sedeId) ?? i.sedeId,
        i.name,
        i.category,
        i.tags.join(", "),
        i.quantity,
        i.unit,
        i.condition,
        i.donorId ? donorMap.get(i.donorId) ?? "Organización" : "Particular",
        i.photoUrl ?? "",
        i.status,
      ]),
    ]);
  };

  return (
    <div className="gd-analytics">
      <div className="dn-grid-2" style={{ alignItems: "start" }}>
        <Panel
          title="Conexión con Google Sheets, Drive y Gemini"
          subtitle="Conectá tu Apps Script compartido para sincronizar sedes, inventario, códigos y fotos."
          action={
            <Badge
              status={
                syncStatus.state === "syncing"
                  ? "Sincronizando"
                  : connected
                  ? "Sincronizado"
                  : "Planilla no conectada"
              }
            />
          }
        >
          <form onSubmit={handleSaveConfig} style={{ display: "grid", gap: 12 }}>
            <div className="dn-field">
              <label htmlFor="cfg-endpoint">Endpoint Web App de Apps Script (/exec)</label>
              <input
                id="cfg-endpoint"
                type="url"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={sheetsEndpoint}
                onChange={(e) => setSheetsEndpoint(e.target.value)}
                className="dn-input"
              />
            </div>

            <div className="dn-field">
              <label htmlFor="cfg-sheet-url">URL de la planilla de Google Sheets</label>
              <input
                id="cfg-sheet-url"
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                className="dn-input"
              />
            </div>

            <div className="dn-field">
              <label htmlFor="cfg-gemini">
                Clave local opcional de Gemini (solo pruebas en este dispositivo)
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  id="cfg-gemini"
                  type={showKey ? "text" : "password"}
                  placeholder="AIza..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="dn-input"
                />
                <button
                  type="button"
                  className="gd-icon-button"
                  aria-label={showKey ? "Ocultar API key" : "Mostrar API key"}
                  onClick={() => setShowKey((v) => !v)}
                >
                  {showKey ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
              <small style={{ color: "var(--gd-muted)", fontSize: 12, lineHeight: 1.4 }}>
                En producción configurá <code>GEMINI_API_KEY</code> en Propiedades del Script de Apps
                Script para no exponer la clave en el navegador.
              </small>
            </div>

            {pingResult && (
              <div
                role="status"
                style={{
                  padding: "8px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--gd-line)",
                  background: "var(--gd-inner)",
                  fontSize: 12,
                  color: "var(--gd-ink)",
                }}
              >
                {pingResult.message}
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="submit" className="gd-primary">
                <Save aria-hidden="true" />
                <span>Guardar configuración</span>
              </button>
              <button
                type="button"
                className="gd-secondary"
                disabled={testing || !connected}
                onClick={() => void handleTestConnection()}
              >
                <Activity aria-hidden="true" />
                <span>{testing ? "Probando..." : "Probar conexión"}</span>
              </button>
              <button
                type="button"
                className="gd-secondary"
                disabled={syncStatus.state === "syncing" || !connected}
                onClick={() => void handleSyncPending()}
              >
                <RefreshCw
                  className={syncStatus.state === "syncing" ? "animate-spin" : ""}
                  aria-hidden="true"
                />
                <span>Sincronizar ahora ({syncStatus.pendingCount})</span>
              </button>
            </div>
          </form>
        </Panel>

        <Panel
          title="Acceso a la hoja, invitación y respaldos"
          subtitle="Compartí el enlace con otras sedes o descargá la tabla actual en CSV."
        >
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                className="gd-primary"
                disabled={!connected}
                onClick={() => void handleCopyInviteLink()}
              >
                <Copy aria-hidden="true" />
                <span>Copiar enlace de invitación</span>
              </button>
              {sheetUrl.trim() && (
                <a
                  href={sheetUrl.trim()}
                  target="_blank"
                  rel="noreferrer"
                  className="gd-secondary"
                >
                  <ExternalLink aria-hidden="true" />
                  <span>Abrir en Google Sheets</span>
                </a>
              )}
              <button
                type="button"
                className="gd-secondary"
                onClick={() => setShowPreviewRows((v) => !v)}
              >
                <FileSpreadsheet aria-hidden="true" />
                <span>
                  {showPreviewRows ? "Ocultar tabla sincronizada" : `Ver resumen (${items.length})`}
                </span>
              </button>
              <button type="button" className="gd-secondary" onClick={handleExportAll}>
                <ArrowDownToLine aria-hidden="true" />
                <span>Exportar CSV</span>
              </button>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 14,
                border: "1px solid var(--gd-line)",
                background: "var(--gd-inner)",
                fontSize: 12,
                lineHeight: 1.5,
                color: "var(--gd-muted)",
              }}
            >
              <strong style={{ color: "var(--gd-ink)", display: "block", marginBottom: 4 }}>
                Cómo conectar tu propia planilla + Drive (gratis)
              </strong>
              1. Creá una hoja en Google Sheets y abrí <b>Extensiones › Apps Script</b>.
              <br />
              2. Pegá <code>apps-script/Code.gs</code> y opcionalmente definí{" "}
              <code>GEMINI_API_KEY</code> en <b>Propiedades del script</b>.
              <br />
              3. Implementalo como <b>Aplicación web</b> (Ejecutar como: yo · Acceso: cualquier
              usuario) y pegá la URL <code>/exec</code> acá.
            </div>

            {onClearDemo && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="gd-secondary"
                  onClick={() => {
                    if (
                      window.confirm(
                        "¿Borrar todas las sedes, donantes e ítems de ejemplo? Los registros que cargaste manualmente se mantienen."
                      )
                    ) {
                      onClearDemo();
                      toast.success("Datos de ejemplo eliminados");
                    }
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  <span>Borrar datos de ejemplo</span>
                </button>
              </div>
            )}
          </div>
        </Panel>
      </div>

      {showPreviewRows && (
        <Panel title={`Inventario consolidado (${items.length})`}>
          <div className="gd-table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Sede</th>
                  <th scope="col">Producto</th>
                  <th scope="col">Categoría</th>
                  <th scope="col">Cantidad</th>
                  <th scope="col">Donante</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 30).map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{sedeMap.get(item.sedeId) ?? item.sedeId}</td>
                    <td>{item.name}</td>
                    <td>{item.category}</td>
                    <td>
                      {item.quantity} {item.unit}
                    </td>
                    <td>{item.donorId ? donorMap.get(item.donorId) ?? "Organización" : "Particular"}</td>
                    <td>{item.synced ? "Sincronizado" : "Pendiente"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length === 0 && <p className="gd-empty">Todavía no hay registros cargados.</p>}
        </Panel>
      )}

      {embedUrl && (
        <Panel
          title="Vista previa de Google Sheets"
          subtitle="Requiere tener acceso de lectura a la hoja en tu cuenta de Google."
        >
          <iframe
            title="Planilla de inventario doná"
            src={embedUrl}
            style={{
              width: "100%",
              height: 460,
              border: "1px solid var(--gd-line)",
              borderRadius: 14,
              background: "#fff",
            }}
          />
        </Panel>
      )}
    </div>
  );
}
