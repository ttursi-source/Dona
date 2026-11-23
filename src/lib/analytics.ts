import type { ChartTone } from "@/components/ui/glassy-dashboard";
import type { Donor, InventoryItem, PeriodOption, Sede } from "./types";

export function periodToDays(period: PeriodOption): number {
  if (period === "7 días") return 7;
  if (period === "90 días") return 90;
  return 30;
}

export interface SummaryMetrics {
  stockUnits: number;
  stockLots: number;
  intakeUnits: number;
  intakeLots: number;
  deliveredUnits: number;
  deliveredLots: number;
  activeDonors: number;
  activeSedes: number;
  totalSedes: number;
}

export function computeSummary(
  items: InventoryItem[],
  donors: Donor[],
  sedes: Sede[],
  periodDays: number,
  now = new Date()
): SummaryMetrics {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - periodDays);
  const cutoffMs = cutoff.getTime();

  const available = items.filter((i) => i.status === "disponible");
  const periodItems = items.filter((i) => new Date(i.createdAt).getTime() >= cutoffMs);
  const deliveredInPeriod = items.filter(
    (i) => i.status === "entregado" && new Date(i.deliveredAt ?? i.createdAt).getTime() >= cutoffMs
  );

  const activeDonorIds = new Set(
    periodItems.map((i) => i.donorId).filter((id): id is string => Boolean(id))
  );
  const activeSedeIds = new Set(periodItems.map((i) => i.sedeId));
  const operationalSedes = sedes.filter((s) => !s.isCentral && s.active !== false);

  return {
    stockUnits: available.reduce((sum, i) => sum + i.quantity, 0),
    stockLots: available.length,
    intakeUnits: periodItems.reduce((sum, i) => sum + i.quantity, 0),
    intakeLots: periodItems.length,
    deliveredUnits: deliveredInPeriod.reduce((sum, i) => sum + i.quantity, 0),
    deliveredLots: deliveredInPeriod.length,
    activeDonors: activeDonorIds.size || donors.length,
    activeSedes: activeSedeIds.size,
    totalSedes: operationalSedes.length > 0 ? operationalSedes.length : sedes.length,
  };
}

export interface IntakeBucket {
  label: string;
  lower: number; // Particulares
  upper: number; // Organizaciones / empresas
}

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function computeIntakeBuckets(
  items: InventoryItem[],
  periodDays: number,
  now = new Date()
): IntakeBucket[] {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const bucketCount = 7;
  const spanDays = periodDays / bucketCount;

  const buckets: IntakeBucket[] = [];
  for (let b = 0; b < bucketCount; b++) {
    const startMs = end.getTime() - (bucketCount - b) * spanDays * 86400000;
    const endMs = end.getTime() - (bucketCount - b - 1) * spanDays * 86400000;
    const endDate = new Date(endMs);

    const label =
      periodDays <= 7
        ? DAY_NAMES[endDate.getDay()]
        : `${String(endDate.getDate()).padStart(2, "0")}/${String(endDate.getMonth() + 1).padStart(2, "0")}`;

    let individual = 0;
    let orgs = 0;
    for (const item of items) {
      const t = new Date(item.createdAt).getTime();
      if (t >= startMs && t <= endMs) {
        if (item.donorId) orgs += item.quantity;
        else individual += item.quantity;
      }
    }

    buckets.push({ label, lower: individual, upper: orgs });
  }
  return buckets;
}

export interface CategoryMixResult {
  labels: string[];
  mix: number[];
  tones: ChartTone[];
  totalUnits: number;
  breakdown: { category: string; units: number; lots: number }[];
}

export function computeCategoryMix(items: InventoryItem[]): CategoryMixResult {
  const available = items.filter((i) => i.status === "disponible");
  const source = available.length > 0 ? available : items;
  const counts = new Map<string, { units: number; lots: number }>();

  for (const item of source) {
    const entry = counts.get(item.category) ?? { units: 0, lots: 0 };
    entry.units += item.quantity;
    entry.lots += 1;
    counts.set(item.category, entry);
  }

  const sorted = Array.from(counts.entries())
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.units - a.units);

  const totalUnits = sorted.reduce((sum, s) => sum + s.units, 0);
  if (totalUnits === 0 || sorted.length === 0) {
    return {
      labels: ["Sin stock"],
      mix: [100],
      tones: ["ink"],
      totalUnits: 0,
      breakdown: [],
    };
  }

  const top = sorted.slice(0, 3);
  const restUnits = sorted.slice(3).reduce((sum, s) => sum + s.units, 0);
  const grouped = restUnits > 0 ? [...top, { category: "Otros", units: restUnits, lots: 0 }] : top;

  const rawPcts = grouped.map((g) => Math.round((g.units / totalUnits) * 100));
  const diff = 100 - rawPcts.reduce((a, b) => a + b, 0);
  if (rawPcts.length > 0) {
    rawPcts[0] = Math.max(0, rawPcts[0] + diff);
  }

  const palette: ChartTone[] = ["teal", "coral", "ink", "ochre"];

  return {
    labels: grouped.map((g) => g.category),
    mix: rawPcts,
    tones: grouped.map((_, idx) => palette[idx % palette.length]),
    totalUnits,
    breakdown: sorted,
  };
}

export function computeTopTags(
  items: InventoryItem[],
  limit = 15
): { tag: string; lots: number; units: number }[] {
  const map = new Map<string, { lots: number; units: number }>();
  for (const item of items) {
    if (item.status !== "disponible") continue;
    for (const tag of item.tags) {
      const clean = tag.trim().toLowerCase();
      if (!clean) continue;
      const cur = map.get(clean) ?? { lots: 0, units: 0 };
      cur.lots += 1;
      cur.units += item.quantity;
      map.set(clean, cur);
    }
  }
  return Array.from(map.entries())
    .map(([tag, v]) => ({ tag, ...v }))
    .sort((a, b) => b.units - a.units || b.lots - a.lots)
    .slice(0, limit);
}

export interface SedeMetricRow {
  sede: Sede;
  stockUnits: number;
  stockLots: number;
  intakeUnits: number;
  deliveredUnits: number;
  lastLoadAt: string | null;
  topCategories: string[];
  alerts: string[];
}

const CRITICAL_CATEGORIES = ["Alimentos", "Higiene y limpieza", "Medicamentos y salud"] as const;

export function computeSedeMetrics(
  sedes: Sede[],
  items: InventoryItem[],
  periodDays: number,
  now = new Date()
): SedeMetricRow[] {
  const cutoffMs = now.getTime() - periodDays * 86400000;
  const staleCutoffMs = now.getTime() - 14 * 86400000;
  const expiryLimitMs = now.getTime() + 15 * 86400000;

  return sedes
    .filter(
      (s) =>
        (!s.isCentral && s.active !== false) || items.some((i) => i.sedeId === s.id)
    )
    .map((sede) => {
      const sedeItems = items.filter((i) => i.sedeId === sede.id);
      const available = sedeItems.filter((i) => i.status === "disponible");
      const intake = sedeItems.filter((i) => new Date(i.createdAt).getTime() >= cutoffMs);
      const delivered = sedeItems.filter(
        (i) => i.status === "entregado" && new Date(i.deliveredAt ?? i.createdAt).getTime() >= cutoffMs
      );

      const sortedDates = sedeItems
        .map((i) => i.createdAt)
        .sort((a, b) => b.localeCompare(a));
      const lastLoadAt = sortedDates[0] ?? null;

      const catTotals = new Map<string, number>();
      for (const item of available) {
        catTotals.set(item.category, (catTotals.get(item.category) ?? 0) + item.quantity);
      }
      const topCategories = Array.from(catTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([c]) => c);

      const alerts: string[] = [];
      if (!sede.isCentral) {
        if (!lastLoadAt || new Date(lastLoadAt).getTime() < staleCutoffMs) {
          alerts.push("Sin ingresos hace +14 días");
        }
        const expiringCount = available.filter(
          (i) => i.perishable && i.expiresAt && new Date(i.expiresAt).getTime() <= expiryLimitMs
        ).length;
        if (expiringCount > 0) {
          alerts.push(`${expiringCount} perecedero(s) por vencer`);
        }
        for (const cat of CRITICAL_CATEGORIES) {
          if (!catTotals.has(cat)) {
            alerts.push(`Sin stock en ${cat}`);
          }
        }
      }

      return {
        sede,
        stockUnits: available.reduce((s, i) => s + i.quantity, 0),
        stockLots: available.length,
        intakeUnits: intake.reduce((s, i) => s + i.quantity, 0),
        deliveredUnits: delivered.reduce((s, i) => s + i.quantity, 0),
        lastLoadAt,
        topCategories,
        alerts,
      };
    });
}

export interface DonorMetricRow {
  donor: Donor;
  totalUnits: number;
  totalLots: number;
  availableUnits: number;
  sedeNames: string[];
  lastDonationAt: string | null;
}

export function computeDonorMetrics(
  donors: Donor[],
  items: InventoryItem[],
  sedes: Sede[]
): DonorMetricRow[] {
  const sedeMap = new Map(sedes.map((s) => [s.id, s.name]));

  return donors
    .map((donor) => {
      const donorItems = items.filter((i) => i.donorId === donor.id);
      const available = donorItems.filter((i) => i.status === "disponible");
      const sedeSet = new Set(
        donorItems.map((i) => sedeMap.get(i.sedeId)).filter((n): n is string => Boolean(n))
      );
      const lastDonationAt =
        donorItems.map((i) => i.createdAt).sort((a, b) => b.localeCompare(a))[0] ?? null;

      return {
        donor,
        totalUnits: donorItems.reduce((s, i) => s + i.quantity, 0),
        totalLots: donorItems.length,
        availableUnits: available.reduce((s, i) => s + i.quantity, 0),
        sedeNames: Array.from(sedeSet),
        lastDonationAt,
      };
    })
    .sort((a, b) => b.totalUnits - a.totalUnits || b.totalLots - a.totalLots);
}

export interface NetworkAlert {
  id: string;
  severity: "alta" | "media";
  title: string;
  detail: string;
  sedeId?: string;
}

export function computeAlerts(
  sedes: Sede[],
  items: InventoryItem[],
  now = new Date()
): NetworkAlert[] {
  const alerts: NetworkAlert[] = [];
  const staleCutoffMs = now.getTime() - 14 * 86400000;
  const expiryLimitMs = now.getTime() + 15 * 86400000;

  for (const sede of sedes.filter((s) => !s.isCentral && s.active !== false)) {
    const sedeItems = items.filter((i) => i.sedeId === sede.id);
    const available = sedeItems.filter((i) => i.status === "disponible");

    const latest = sedeItems.map((i) => i.createdAt).sort((a, b) => b.localeCompare(a))[0];
    if (!latest || new Date(latest).getTime() < staleCutoffMs) {
      alerts.push({
        id: `stale-${sede.id}`,
        severity: "media",
        title: `${sede.name} sin movimientos recientes`,
        detail: "No registra ingresos en los últimos 14 días.",
        sedeId: sede.id,
      });
    }

    for (const item of available) {
      if (item.perishable && item.expiresAt) {
        const expMs = new Date(item.expiresAt).getTime();
        if (expMs <= expiryLimitMs) {
          const daysLeft = Math.ceil((expMs - now.getTime()) / 86400000);
          alerts.push({
            id: `exp-${item.id}`,
            severity: "alta",
            title: `${item.name} (${sede.name})`,
            detail:
              daysLeft <= 0
                ? `Vencido el ${item.expiresAt}. Priorizar revisión.`
                : `Vence en ${daysLeft} día(s) (${item.expiresAt}).`,
            sedeId: sede.id,
          });
        }
      }
    }

    const catsWithStock = new Set(available.map((i) => i.category));
    const missingCritical = CRITICAL_CATEGORIES.filter((cat) => !catsWithStock.has(cat));
    if (missingCritical.length > 0) {
      alerts.push({
        id: `crit-${sede.id}`,
        severity: "media",
        title: `Stock crítico faltante en ${sede.name}`,
        detail: `Sin unidades disponibles en: ${missingCritical.join(", ")}.`,
        sedeId: sede.id,
      });
    }
  }

  return alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "alta" ? -1 : 1));
}
