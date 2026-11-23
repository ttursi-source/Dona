import { useMemo, useState } from "react";
import { ArrowDownToLine, CheckCircle2, Eye, Filter, Package, Search, Trash2 } from "lucide-react";
import { PhotoLightbox } from "@/components/dona/PhotoLightbox";
import { Badge, Panel, saveCsv } from "@/components/ui/glassy-dashboard";
import { CATEGORIES, type Donor, type InventoryItem, type Sede } from "@/lib/types";

interface InventoryTableProps {
  items: InventoryItem[];
  donors: Donor[];
  sedes?: Sede[];
  showSedeColumn?: boolean;
  onMarkDelivered: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
  exportFilename?: string;
}

export function InventoryTable({
  items,
  donors,
  sedes = [],
  showSedeColumn = false,
  onMarkDelivered,
  onDelete,
  exportFilename = "dona-inventario.csv",
}: InventoryTableProps) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [statusFilter, setStatusFilter] = useState<"Todos" | "disponible" | "entregado">("Todos");
  const [previewItem, setPreviewItem] = useState<InventoryItem | null>(null);

  const donorMap = useMemo(() => new Map(donors.map((d) => [d.id, d.name])), [donors]);
  const sedeMap = useMemo(() => new Map(sedes.map((s) => [s.id, s.name])), [sedes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== "Todas" && item.category !== categoryFilter) return false;
      if (statusFilter !== "Todos" && item.status !== statusFilter) return false;
      if (!q) return true;
      const donorName = item.donorId ? donorMap.get(item.donorId) ?? "" : "particular";
      const sedeName = sedeMap.get(item.sedeId) ?? "";
      const haystack = [item.name, item.category, ...item.tags, donorName, sedeName, item.notes ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query, categoryFilter, statusFilter, donorMap, sedeMap]);

  const handleExport = () => {
    saveCsv(exportFilename, [
      ["ID", "Fecha", "Sede", "Producto", "Categoría", "Etiquetas", "Cantidad", "Unidad", "Estado", "Donante", "Stock", "Sincronizado"],
      ...filtered.map((item) => [
        item.id,
        new Date(item.createdAt).toLocaleDateString("es-AR"),
        sedeMap.get(item.sedeId) ?? item.sedeId,
        item.name,
        item.category,
        item.tags.join(", "),
        item.quantity,
        item.unit,
        item.condition,
        item.donorId ? donorMap.get(item.donorId) ?? "Organización" : "Particular",
        item.status,
        item.synced ? "Sí" : "No",
      ]),
    ]);
  };

  return (
    <Panel
      title={`Inventario (${filtered.length})`}
      subtitle="Buscá por producto, etiqueta o donante."
      action={
        <div className="gd-table-tools">
          <label className="gd-search">
            <Search aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar producto o tag"
              aria-label="Buscar en el inventario"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="gd-filter">
            <Filter aria-hidden="true" />
            <select
              aria-label="Filtrar por categoría"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="Todas">Todas las categorías</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="gd-filter">
            <select
              aria-label="Filtrar por estado"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "Todos" | "disponible" | "entregado")}
            >
              <option value="Todos">Todos</option>
              <option value="disponible">Disponible</option>
              <option value="entregado">Entregado</option>
            </select>
          </label>
          <button type="button" className="gd-primary gd-export" onClick={handleExport}>
            <ArrowDownToLine aria-hidden="true" />
            <span>Exportar CSV</span>
          </button>
        </div>
      }
    >
      <div className="gd-table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Producto</th>
              {showSedeColumn && <th scope="col">Sede</th>}
              <th scope="col">Categoría</th>
              <th scope="col">Cantidad</th>
              <th scope="col">Donante</th>
              <th scope="col">Fecha</th>
              <th scope="col">Estado</th>
              <th scope="col">Planilla</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const imgSrc = item.photoThumb || item.photoUrl;
              const donorLabel = item.donorId ? donorMap.get(item.donorId) ?? "Organización" : "Particular";
              return (
                <tr key={item.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {imgSrc ? (
                        <button
                          type="button"
                          onClick={() => setPreviewItem(item)}
                          title="Ver foto completa"
                          aria-label={`Ver foto de ${item.name}`}
                          style={{
                            padding: 0,
                            border: 0,
                            background: "transparent",
                            display: "inline-flex",
                            borderRadius: 10,
                          }}
                        >
                          <img src={imgSrc} alt={item.name} className="dn-thumb" />
                        </button>
                      ) : (
                        <span className="gd-list-icon" aria-hidden="true">
                          <Package />
                        </span>
                      )}
                      <div>
                        <div style={{ fontWeight: 780 }}>{item.name}</div>
                        <div style={{ fontSize: 10, color: "var(--gd-muted)", marginTop: 2 }}>
                          {item.tags.slice(0, 4).map((t) => `#${t}`).join(" ")}
                        </div>
                      </div>
                    </div>
                  </td>
                  {showSedeColumn && <td>{sedeMap.get(item.sedeId) ?? item.sedeId}</td>}
                  <td>{item.category}</td>
                  <td>
                    <strong>{item.quantity}</strong> {item.unit}
                  </td>
                  <td>{donorLabel}</td>
                  <td>{new Date(item.createdAt).toLocaleDateString("es-AR")}</td>
                  <td>
                    <Badge status={item.status === "disponible" ? "Disponible" : "Entregado"} />
                  </td>
                  <td>
                    <Badge status={item.synced ? "Sincronizado" : "Pendiente"} />
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      {imgSrc && (
                        <button
                          type="button"
                          className="gd-secondary"
                          style={{ minBlockSize: 32, padding: "4px 10px", fontSize: 11 }}
                          onClick={() => setPreviewItem(item)}
                        >
                          <Eye aria-hidden="true" />
                          <span>Ver foto</span>
                        </button>
                      )}
                      {item.status === "disponible" && (
                        <button
                          type="button"
                          className="gd-secondary"
                          style={{ minBlockSize: 32, padding: "4px 10px", fontSize: 11 }}
                          onClick={() => onMarkDelivered(item)}
                        >
                          <CheckCircle2 aria-hidden="true" />
                          <span>Entregar</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="gd-icon-button"
                        style={{ minInlineSize: 34, minBlockSize: 34 }}
                        aria-label={`Eliminar ${item.name}`}
                        title="Eliminar"
                        onClick={() => {
                          if (window.confirm(`¿Eliminar "${item.name}" del inventario?`)) {
                            onDelete(item);
                          }
                        }}
                      >
                        <Trash2 style={{ width: 14, height: 14 }} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <p className="gd-empty" role="status">
          No hay donaciones que coincidan con los filtros actuales.
        </p>
      )}
      <PhotoLightbox
        item={previewItem}
        sedeName={previewItem ? sedeMap.get(previewItem.sedeId) : undefined}
        donorName={
          previewItem?.donorId ? donorMap.get(previewItem.donorId) ?? "Organización" : "Particular"
        }
        onClose={() => setPreviewItem(null)}
      />
    </Panel>
  );
}
