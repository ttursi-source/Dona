import type { DonaConfig } from "./types";

const CONFIG_KEY = "dona:config";

function envDefaults(): DonaConfig {
  return {
    geminiKey: (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() ?? "",
    sheetsEndpoint: (import.meta.env.VITE_SHEETS_ENDPOINT as string | undefined)?.trim() ?? "",
    sheetUrl: (import.meta.env.VITE_SHEET_URL as string | undefined)?.trim() ?? "",
  };
}

export function isValidEndpointUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || /[\s\u0000-\u001F]/.test(trimmed)) return false;
  try {
    const u = new URL(trimmed);
    if (u.protocol === "https:") return true;
    if (
      u.protocol === "http:" &&
      (u.hostname === "127.0.0.1" || u.hostname === "localhost")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getConfig(): DonaConfig {
  const fallback = envDefaults();
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<DonaConfig>;
    return {
      geminiKey: parsed.geminiKey?.trim() || fallback.geminiKey,
      sheetsEndpoint: parsed.sheetsEndpoint?.trim() || fallback.sheetsEndpoint,
      sheetUrl: parsed.sheetUrl?.trim() || fallback.sheetUrl,
    };
  } catch {
    return fallback;
  }
}

export function setConfig(next: Partial<DonaConfig>): DonaConfig {
  const current = getConfig();
  const merged: DonaConfig = {
    geminiKey: next.geminiKey !== undefined ? next.geminiKey.trim() : current.geminiKey,
    sheetsEndpoint: next.sheetsEndpoint !== undefined ? next.sheetsEndpoint.trim() : current.sheetsEndpoint,
    sheetUrl: next.sheetUrl !== undefined ? next.sheetUrl.trim() : current.sheetUrl,
  };
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
  } catch {
    // Ignore storage quota issues for config
  }
  return merged;
}

export function captureEndpointFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  let candidate: string | null = null;

  try {
    const searchParams = new URLSearchParams(window.location.search);
    candidate = searchParams.get("ep");
    if (!candidate && window.location.hash.includes("?")) {
      const hashQuery = window.location.hash.split("?")[1] ?? "";
      candidate = new URLSearchParams(hashQuery).get("ep");
    }
  } catch {
    return null;
  }

  if (!candidate) return null;
  const trimmed = candidate.trim();
  if (!isValidEndpointUrl(trimmed)) return null;

  const current = getConfig();
  if (current.sheetsEndpoint !== trimmed) {
    setConfig({ sheetsEndpoint: trimmed });
  }
  return trimmed;
}

export function toEmbedSheetUrl(sheetUrl: string): string | null {
  const trimmed = sheetUrl.trim();
  if (!trimmed) return null;
  if (!/^https:\/\/docs\.google\.com\/spreadsheets\//i.test(trimmed)) return null;
  if (trimmed.includes("/preview")) return trimmed;
  if (trimmed.includes("/edit")) {
    return trimmed.replace(/\/edit.*$/i, "/preview");
  }
  return trimmed.replace(/\/+$/, "") + "/preview";
}
