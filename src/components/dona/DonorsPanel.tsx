import { useState, type FormEvent } from "react";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/ui/glassy-dashboard";
import { computeDonorMetrics } from "@/lib/analytics";
import { addDonor } from "@/lib/store";
import { scheduleSync } from "@/lib/sync";
import { DONOR_KINDS, type Donor, type DonorKind, type InventoryItem, type Sede } from "@/lib/types";

interface DonorsPanelProps {
  orgId: string;
  donors: Donor[];
  items: InventoryItem[];
  sedes: Sede[];
  showSedes?: boolean;
}

export function DonorsPanel({
  orgId,
  donors,
  items,
  sedes,
  showSedes = false,
}: DonorsPanelProps) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<DonorKind>("empresa");
  const [cuit, setCuit] = useState("");
  const [contact, setContact] = useState("");

  const rows = computeDonorMetrics(donors, items, sedes);

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Ingresá el nombre de la organización o empresa.");
      return;
    }
    const created = addDonor({ orgId, name, kind, cuit, contact });
    setName("");
    setCuit("");
    setContact("");
    toast.success(`Organización donante "${created.name}" registrada`);
    scheduleSync();
  };

  return (
    <div className="gd-analytics">
      <div className="dn-grid-2" style={{ alignItems: "start" }}>
        <Panel
          title={`Organizaciones y empresas donantes (${rows.length})`}
          subtitle="Aportes registrados y volumen total recibido."
        >
          <div className="gd-table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Organización</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Unidades</th>
                  <th scope="col">Lotes</th>
                  {showSedes && <th scope="col">Sedes</th>}
                  <th scope="col">Última donación</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ donor, totalUnits, totalLots, sedeNames, lastDonationAt }) => (
                  <tr key={donor.id}>
                    <td>
                      <div style={{ fontWeight: 780 }}>{donor.name}</div>
                      {donor.contact && (
                        <div style={{ fontSize: 10, color: "var(--gd-muted)" }}>{donor.contact}</div>
                      )}
                    </td>
                    <td style={{ textTransform: "capitalize" }}>{donor.kind}</td>
                    <td>
                      <strong>{totalUnits}</strong>
                    </td>
                    <td>{totalLots}</td>
                    {showSedes && (
                      <td>{sedeNames.length > 0 ? sedeNames.join(", ") : "—"}</td>
                    )}
                    <td>
                      {lastDonationAt
                        ? new Date(lastDonationAt).toLocaleDateString("es-AR")
                        : "Sin registros"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && (
            <p className="gd-empty">Todavía no hay empresas u organizaciones donantes cargadas.</p>
          )}
        </Panel>

        <Panel
          title="Registrar donante institucional"
          subtitle="Empresas, supermercados, farmacias u otras entidades que donan seguido."
        >
          <form onSubmit={handleAdd} style={{ display: "grid", gap: 12 }}>
            <div className="dn-field">
              <label htmlFor="donor-name">Razón social / nombre *</label>
              <input
                id="donor-name"
                type="text"
                required
                placeholder="Ej: Distribuidora Sur S.A."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="dn-input"
              />
            </div>

            <div className="dn-grid-2">
              <div className="dn-field">
                <label htmlFor="donor-kind">Tipo</label>
                <select
                  id="donor-kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as DonorKind)}
                  className="dn-select"
                >
                  {DONOR_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div className="dn-field">
                <label htmlFor="donor-cuit">CUIT (opcional)</label>
                <input
                  id="donor-cuit"
                  type="text"
                  placeholder="30-71234567-8"
                  value={cuit}
                  onChange={(e) => setCuit(e.target.value)}
                  className="dn-input"
                />
              </div>
            </div>

            <div className="dn-field">
              <label htmlFor="donor-contact">Contacto (email / teléfono)</label>
              <input
                id="donor-contact"
                type="text"
                placeholder="rse@empresa.com"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="dn-input"
              />
            </div>

            <button type="submit" className="gd-primary" style={{ minBlockSize: 44 }}>
              <Building2 aria-hidden="true" />
              <Plus aria-hidden="true" />
              <span>Agregar donante</span>
            </button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
