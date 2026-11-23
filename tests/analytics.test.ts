import { describe, expect, it } from "vitest";
import {
  computeAlerts,
  computeCategoryMix,
  computeSedeMetrics,
  computeSummary,
  computeTopTags,
} from "../src/lib/analytics";
import type { Donor, InventoryItem, Sede } from "../src/lib/types";

const NOW = new Date("2026-11-23T12:00:00.000Z");

const SEDES: Sede[] = [
  {
    id: "central",
    orgId: "org-1",
    name: "Sede Central",
    locality: "CABA",
    isCentral: true,
    joinedAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    active: true,
  },
  {
    id: "sede-activa",
    orgId: "org-1",
    name: "Parroquia Activa",
    locality: "Boedo",
    isCentral: false,
    joinedAt: "2026-10-05T00:00:00Z",
    updatedAt: "2026-10-05T00:00:00Z",
    active: true,
  },
  {
    id: "sede-baja",
    orgId: "org-1",
    name: "Sede Dada de Baja",
    locality: "Morón",
    isCentral: false,
    joinedAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-11-10T00:00:00Z",
    active: false,
  },
  {
    id: "sede-baja-con-historial",
    orgId: "org-1",
    name: "Sede Cerrada Con Stock",
    locality: "Quilmes",
    isCentral: false,
    joinedAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-11-10T00:00:00Z",
    active: false,
  },
];

const DONORS: Donor[] = [
  {
    id: "don-1",
    orgId: "org-1",
    name: "Molinos Ejemplo",
    kind: "empresa",
    createdAt: "2026-10-10T00:00:00Z",
    updatedAt: "2026-10-10T00:00:00Z",
  },
];

const ITEMS: InventoryItem[] = [
  {
    id: "i1",
    orgId: "org-1",
    sedeId: "sede-activa",
    name: "Fideos",
    category: "Alimentos",
    tags: ["fideos", "no perecedero"],
    quantity: 40,
    unit: "paquetes",
    condition: "nuevo",
    perishable: false,
    donorId: "don-1",
    status: "disponible",
    createdAt: "2026-11-22T10:00:00Z",
    updatedAt: "2026-11-22T10:00:00Z",
    aiSource: "manual",
  },
  {
    id: "i2",
    orgId: "org-1",
    sedeId: "sede-baja-con-historial",
    name: "Camperas",
    category: "Ropa y calzado",
    tags: ["abrigo"],
    quantity: 10,
    unit: "unidades",
    condition: "buen estado",
    perishable: false,
    donorId: null,
    status: "disponible",
    createdAt: "2026-10-20T10:00:00Z",
    updatedAt: "2026-10-20T10:00:00Z",
    aiSource: "manual",
  },
  {
    id: "i3",
    orgId: "org-1",
    sedeId: "sede-activa",
    name: "Leche UHT",
    category: "Alimentos",
    tags: ["lacteos"],
    quantity: 12,
    unit: "litros",
    condition: "nuevo",
    perishable: true,
    expiresAt: "2026-11-26",
    donorId: "don-1",
    status: "disponible",
    createdAt: "2026-11-21T10:00:00Z",
    updatedAt: "2026-11-21T10:00:00Z",
    aiSource: "gemini",
  },
];

describe("analytics metrics and inactive sede filtering", () => {
  it("excludes inactive and central sedes from operational summary count", () => {
    const summary = computeSummary(ITEMS, DONORS, SEDES, 30, NOW);
    expect(summary.totalSedes).toBe(1);
    expect(summary.stockUnits).toBe(62);
    expect(summary.stockLots).toBe(3);
    expect(summary.intakeUnits).toBe(52);
    expect(summary.activeDonors).toBe(1);
  });

  it("keeps inactive sedes with historical items in sede breakdown while excluding empty inactive ones", () => {
    const rows = computeSedeMetrics(SEDES, ITEMS, 30, NOW);
    const ids = rows.map((r) => r.sede.id);
    expect(ids).toContain("sede-activa");
    expect(ids).toContain("sede-baja-con-historial");
    expect(ids).not.toContain("sede-baja");
    expect(ids).not.toContain("central");
  });

  it("does not emit operational alerts for inactive sedes", () => {
    const alerts = computeAlerts(SEDES, ITEMS, NOW);
    const joined = alerts.map((a) => `${a.title} ${a.detail}`).join(" | ");
    expect(joined).not.toContain("Sede Dada de Baja");
    expect(joined).not.toContain("Sede Cerrada Con Stock");
  });

  it("computes category mix and top tags correctly", () => {
    const mix = computeCategoryMix(ITEMS);
    expect(mix.totalUnits).toBe(62);
    expect(mix.labels[0]).toBe("Alimentos");

    const tags = computeTopTags(ITEMS);
    expect(tags[0]).toEqual({ tag: "fideos", lots: 1, units: 40 });
  });
});
