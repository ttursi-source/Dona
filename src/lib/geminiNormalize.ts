import { CATEGORIES, ITEM_CONDITIONS, type Category, type ItemCondition } from "./types";

export interface GeminiTagResult {
  nombre: string;
  categoria: Category;
  etiquetas: string[];
  cantidad_estimada: number;
  unidad: string;
  estado: ItemCondition;
  perecedero: boolean;
  vencimiento?: string;
}

function normalizeCategory(raw: unknown): Category {
  if (typeof raw === "string") {
    const found = CATEGORIES.find((c) => c.toLowerCase() === raw.trim().toLowerCase());
    if (found) return found;
  }
  return "Otros";
}

function normalizeCondition(raw: unknown): ItemCondition {
  if (typeof raw === "string") {
    const found = ITEM_CONDITIONS.find((c) => c.toLowerCase() === raw.trim().toLowerCase());
    if (found) return found;
  }
  return "buen estado";
}

function normalizeDate(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined;
}

export function normalizeGeminiResult(parsed: Record<string, unknown>): GeminiTagResult {
  const tags = Array.isArray(parsed.etiquetas)
    ? parsed.etiquetas
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 6)
    : [];

  const qtyRaw = Number(parsed.cantidad_estimada);
  const qty = Number.isFinite(qtyRaw) && qtyRaw >= 1 ? Math.round(qtyRaw) : 1;

  return {
    nombre:
      typeof parsed.nombre === "string" && parsed.nombre.trim()
        ? parsed.nombre.trim()
        : "Donación sin título",
    categoria: normalizeCategory(parsed.categoria),
    etiquetas: tags.length > 0 ? tags : ["donación"],
    cantidad_estimada: qty,
    unidad:
      typeof parsed.unidad === "string" && parsed.unidad.trim() ? parsed.unidad.trim() : "unidades",
    estado: normalizeCondition(parsed.estado),
    perecedero: Boolean(parsed.perecedero),
    vencimiento: normalizeDate(parsed.vencimiento),
  };
}
