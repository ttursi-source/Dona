import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { hashCode } from "./access";
import { getConfig } from "./config";
import { normalizeGeminiResult, type GeminiTagResult } from "./geminiNormalize";
import { getPendingPhoto, removePendingPhoto } from "./photoQueue";
import { getSession, signOut, subscribeSession } from "./session";
import {
  getRawState,
  hydratePublic,
  markEntitiesSynced,
  mergeRemote,
  subscribe,
  updateOrgCodeHash,
  updateSedeCodeHash,
} from "./store";
import type { Donor, InventoryItem, Organization, Sede } from "./types";

export type SyncState = "local" | "idle" | "syncing" | "offline" | "error";

export interface SyncStatus {
  state: SyncState;
  pendingCount: number;
  lastSyncedAt?: string;
  lastError?: string;
}

export interface SyncCallResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

function countPendingEntities(): number {
  const raw = getRawState();
  const session = getSession();
  if (!session) {
    return (
      raw.orgs.filter((o) => !o.demo && o.synced === false).length +
      raw.sedes.filter((s) => !s.demo && s.synced === false).length +
      raw.donors.filter((d) => !d.demo && d.synced === false).length +
      raw.items.filter((i) => !i.demo && i.synced === false).length
    );
  }
  const isCentral = session.role === "central";
  return (
    (isCentral
      ? raw.orgs.filter((o) => !o.demo && o.synced === false && o.id === session.orgId).length
      : 0) +
    raw.sedes.filter(
      (s) =>
        !s.demo &&
        s.synced === false &&
        s.orgId === session.orgId &&
        (isCentral || s.id === session.sedeId)
    ).length +
    raw.donors.filter((d) => !d.demo && d.synced === false && d.orgId === session.orgId).length +
    raw.items.filter(
      (i) =>
        !i.demo &&
        i.synced === false &&
        i.orgId === session.orgId &&
        (isCentral || i.sedeId === session.sedeId)
    ).length
  );
}

function initialSyncState(): SyncState {
  if (!getConfig().sheetsEndpoint) return "local";
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  return "idle";
}

let status: SyncStatus = {
  state: initialSyncState(),
  pendingCount: countPendingEntities(),
};

const statusListeners = new Set<() => void>();

function updateStatus(patch: Partial<SyncStatus>) {
  status = {
    ...status,
    ...patch,
    pendingCount: patch.pendingCount ?? countPendingEntities(),
  };
  statusListeners.forEach((fn) => fn());
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSyncStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);
}

export function refreshSyncStatus(): void {
  const hasEndpoint = Boolean(getConfig().sheetsEndpoint);
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const nextState: SyncState = !hasEndpoint
    ? "local"
    : offline
    ? "offline"
    : status.state === "local" || status.state === "offline"
    ? "idle"
    : status.state;
  updateStatus({ state: nextState, pendingCount: countPendingEntities() });
}

function resolveEndpoint(override?: string): string {
  return (override ?? getConfig().sheetsEndpoint).trim();
}

async function getJson<T extends Record<string, unknown>>(
  endpoint: string,
  params: Record<string, string>
): Promise<T> {
  const sep = endpoint.includes("?") ? "&" : "?";
  const qs = new URLSearchParams(params).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${endpoint}${sep}${qs}`, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function postJson<T extends Record<string, unknown>>(
  endpoint: string,
  payload: Record<string, unknown>,
  timeoutMs = 20000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function pingBackend(endpointOverride?: string): Promise<{
  ok: boolean;
  version?: number;
  hasGeminiKey?: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const endpoint = resolveEndpoint(endpointOverride);
  if (!endpoint) {
    return { ok: false, error: "Ingresá la URL de Apps Script" };
  }
  const t0 = performance.now();
  try {
    const data = await getJson<{
      ok: boolean;
      version?: number;
      hasGeminiKey?: boolean;
      error?: string;
    }>(endpoint, { action: "ping" });
    const latencyMs = Math.round(performance.now() - t0);
    if (!data.ok) {
      return { ok: false, error: data.error || "El servidor respondió con error", latencyMs };
    }
    return {
      ok: true,
      version: data.version,
      hasGeminiKey: data.hasGeminiKey,
      latencyMs,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo conectar con Apps Script",
    };
  }
}

export async function fetchPublicSedes(endpointOverride?: string): Promise<{
  ok: boolean;
  orgs: Organization[];
  sedes: Sede[];
  error?: string;
}> {
  const endpoint = resolveEndpoint(endpointOverride);
  if (!endpoint) {
    return { ok: false, orgs: [], sedes: [], error: "Planilla no conectada" };
  }
  try {
    const data = await getJson<{
      ok: boolean;
      orgs?: Organization[];
      sedes?: Sede[];
      error?: string;
    }>(endpoint, { action: "publicSedes" });
    if (!data.ok) {
      return {
        ok: false,
        orgs: [],
        sedes: [],
        error: data.error || "Error leyendo organizaciones",
      };
    }
    const orgs = Array.isArray(data.orgs) ? data.orgs : [];
    const sedes = Array.isArray(data.sedes) ? data.sedes : [];
    hydratePublic(orgs, sedes);
    return { ok: true, orgs, sedes };
  } catch (err) {
    return {
      ok: false,
      orgs: [],
      sedes: [],
      error: err instanceof Error ? err.message : "Error de red",
    };
  }
}

export async function registerOrgRemote(
  org: Organization,
  centralSede: Sede
): Promise<{ ok: boolean; token?: string; error?: string }> {
  const endpoint = resolveEndpoint();
  if (!endpoint) return { ok: false, error: "Sin endpoint" };
  try {
    const res = await postJson<{
      ok: boolean;
      token?: string;
      serverTime?: number;
      error?: string;
    }>(endpoint, {
      action: "registerOrg",
      org,
      centralSede,
    });
    if (!res.ok || !res.token) {
      return { ok: false, error: res.error || "No se pudo registrar en Google Sheets" };
    }
    markEntitiesSynced({ orgs: [org.id], sedes: [centralSede.id] });
    refreshSyncStatus();
    return { ok: true, token: res.token };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de red" };
  }
}

export async function registerSedeRemote(
  sede: Sede
): Promise<{ ok: boolean; token?: string; error?: string }> {
  const endpoint = resolveEndpoint();
  if (!endpoint) return { ok: false, error: "Sin endpoint" };
  try {
    const res = await postJson<{
      ok: boolean;
      token?: string;
      serverTime?: number;
      error?: string;
    }>(endpoint, {
      action: "registerSede",
      sede,
    });
    if (!res.ok || !res.token) {
      return { ok: false, error: res.error || "No se pudo registrar la sede en Sheets" };
    }
    markEntitiesSynced({ sedes: [sede.id] });
    refreshSyncStatus();
    return { ok: true, token: res.token };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de red" };
  }
}

export async function loginRemote(input: {
  role: "sede" | "central";
  orgId: string;
  sedeId?: string;
  code: string;
}): Promise<{
  ok: boolean;
  token?: string;
  sedeId?: string;
  locked?: boolean;
  remainingAttempts?: number;
  error?: string;
}> {
  const endpoint = resolveEndpoint();
  if (!endpoint) {
    return { ok: false, error: "Planilla no conectada" };
  }
  const scopeId = input.role === "central" ? input.orgId : input.sedeId ?? "";
  if (!scopeId) {
    return { ok: false, error: "Falta identificador de sede" };
  }
  try {
    const codeHash = await hashCode(scopeId, input.code);
    const res = await postJson<{
      ok: boolean;
      token?: string;
      sedeId?: string;
      locked?: boolean;
      remainingAttempts?: number;
      error?: string;
    }>(endpoint, {
      action: "login",
      role: input.role,
      orgId: input.orgId,
      sedeId: input.sedeId,
      codeHash,
    });
    return {
      ok: Boolean(res.ok),
      token: res.token,
      sedeId: res.sedeId,
      locked: res.locked,
      remainingAttempts: res.remainingAttempts,
      error: res.error,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de red" };
  }
}

export async function rotateCodeRemote(input: {
  orgId: string;
  targetType: "sede" | "central";
  targetId: string;
  newCode: string;
}): Promise<{ ok: boolean; error?: string }> {
  const scopeId = input.targetType === "central" ? input.orgId : input.targetId;
  const newCodeHash = await hashCode(scopeId, input.newCode);

  const endpoint = resolveEndpoint();
  const session = getSession();
  if (endpoint && session?.token) {
    try {
      const res = await postJson<{ ok: boolean; error?: string }>(endpoint, {
        action: "rotateCode",
        token: session.token,
        orgId: input.orgId,
        targetType: input.targetType,
        targetId: input.targetId,
        newCodeHash,
      });
      if (!res.ok) {
        return { ok: false, error: res.error || "No se pudo rotar el código" };
      }
      if (input.targetType === "central") {
        updateOrgCodeHash(input.orgId, newCodeHash);
        markEntitiesSynced({ orgs: [input.orgId] });
      } else {
        updateSedeCodeHash(input.targetId, newCodeHash);
        markEntitiesSynced({ sedes: [input.targetId] });
      }
      refreshSyncStatus();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error de red" };
    }
  }

  if (input.targetType === "central") {
    updateOrgCodeHash(input.orgId, newCodeHash);
  } else {
    updateSedeCodeHash(input.targetId, newCodeHash);
  }
  return { ok: true };
}

export async function tagImageViaProxy(
  base64: string,
  mode: "auth" | "public" = "auth"
): Promise<GeminiTagResult> {
  const endpoint = resolveEndpoint();
  if (!endpoint) {
    throw new Error("Planilla no conectada");
  }
  const session = getSession();
  const useAuth = mode === "auth" && Boolean(session?.token) && session?.token !== "local";
  const res = await postJson<{
    ok: boolean;
    result?: Record<string, unknown>;
    missingKey?: boolean;
    rateLimited?: boolean;
    error?: string;
  }>(
    endpoint,
    {
      action: "tag",
      mode: useAuth ? "auth" : "public",
      token: useAuth ? session?.token : undefined,
      clientKey: useAuth ? undefined : "web",
      photoBase64: base64,
    },
    30000
  );

  if (!res.ok || !res.result) {
    throw new Error(res.error || "Error al analizar la imagen con IA");
  }
  return normalizeGeminiResult(res.result);
}

let inFlightSync: Promise<SyncCallResult> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempts = 0;

function clearRetryTimer() {
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

export async function syncNow(): Promise<SyncCallResult> {
  if (inFlightSync) {
    return inFlightSync;
  }

  inFlightSync = runSync().finally(() => {
    inFlightSync = null;
  });
  return inFlightSync;
}

async function runSync(): Promise<SyncCallResult> {
  const endpoint = resolveEndpoint();
  if (!endpoint) {
    updateStatus({ state: "local", pendingCount: countPendingEntities(), lastError: undefined });
    return { ok: false, skipped: true };
  }

  const session = getSession();
  if (!session || !session.token || session.token === "local") {
    updateStatus({ state: "idle", pendingCount: countPendingEntities() });
    return { ok: false, skipped: true };
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    updateStatus({ state: "offline", pendingCount: countPendingEntities() });
    return { ok: false, error: "Sin conexión" };
  }

  clearRetryTimer();
  updateStatus({ state: "syncing", pendingCount: countPendingEntities() });

  const raw = getRawState();
  const isCentral = session.role === "central";

  const orgsToPush = isCentral
    ? raw.orgs.filter((o) => !o.demo && o.synced === false && o.id === session.orgId)
    : [];

  const sedesToPush = raw.sedes.filter((s) => {
    if (s.demo || s.synced !== false || s.orgId !== session.orgId) return false;
    return isCentral ? true : s.id === session.sedeId;
  });

  const donorsToPush = raw.donors.filter(
    (d) => !d.demo && d.synced === false && d.orgId === session.orgId
  );

  const itemsToPush = raw.items.filter((i) => {
    if (i.demo || i.synced !== false || i.orgId !== session.orgId) return false;
    return isCentral ? true : i.sedeId === session.sedeId;
  });

  const photos: Record<string, string> = {};
  for (const item of itemsToPush) {
    if (item.deleted || item.photoUrl) continue;
    const pendingB64 = await getPendingPhoto(item.id);
    if (pendingB64) {
      photos[item.id] = pendingB64;
    } else if (item.photoThumb) {
      photos[item.id] = item.photoThumb;
    }
  }

  try {
    const res = await postJson<{
      ok: boolean;
      unauthorized?: boolean;
      error?: string;
      serverTime?: number;
      syncedIds?: {
        orgs?: string[];
        sedes?: string[];
        donors?: string[];
        items?: string[];
      };
      photoUrls?: Record<string, string>;
      pull?: {
        orgs?: Organization[];
        sedes?: Sede[];
        donors?: Donor[];
        items?: InventoryItem[];
      };
    }>(
      endpoint,
      {
        action: "sync",
        token: session.token,
        since: raw.meta.lastPull || 0,
        orgs: orgsToPush,
        sedes: sedesToPush,
        donors: donorsToPush,
        items: itemsToPush,
        photos,
      },
      30000
    );

    if (res.unauthorized) {
      signOut();
      toast.error(res.error || "Sesión expirada o sede dada de baja. Volvé a ingresar.");
      updateStatus({ state: "error", lastError: res.error || "Sesión inválida" });
      return { ok: false, error: res.error };
    }

    if (!res.ok) {
      throw new Error(res.error || "Error al sincronizar con la planilla");
    }

    if (res.syncedIds || res.photoUrls) {
      markEntitiesSynced(res.syncedIds ?? {}, res.photoUrls ?? {});
    }

    for (const id of Object.keys(photos)) {
      const uploaded = res.photoUrls?.[id] || res.syncedIds?.items?.includes(id);
      if (uploaded) {
        await removePendingPhoto(id);
      }
    }

    if (res.pull) {
      mergeRemote(res.pull, res.serverTime);
    }

    retryAttempts = 0;
    updateStatus({
      state: "idle",
      pendingCount: countPendingEntities(),
      lastSyncedAt: new Date().toISOString(),
      lastError: undefined,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de red";
    retryAttempts += 1;
    const delayMs = Math.min(60000, 2000 * Math.pow(2, retryAttempts - 1));
    if (typeof navigator === "undefined" || navigator.onLine !== false) {
      clearRetryTimer();
      retryTimer = setTimeout(() => {
        void syncNow();
      }, delayMs);
    }
    updateStatus({
      state:
        typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "error",
      pendingCount: countPendingEntities(),
      lastError: msg,
    });
    return { ok: false, error: msg };
  }
}

export function scheduleSync(delayMs = 1500): void {
  const endpoint = resolveEndpoint();
  const session = getSession();
  if (!endpoint || !session?.token || session.token === "local") {
    refreshSyncStatus();
    return;
  }
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void syncNow();
  }, delayMs);
}

let lifecycleInitialized = false;

export function initSyncLifecycle(): () => void {
  if (lifecycleInitialized) {
    return () => {};
  }
  lifecycleInitialized = true;

  const unsubStore = subscribe(() => {
    updateStatus({ pendingCount: countPendingEntities() });
  });
  const unsubSession = subscribeSession(() => {
    refreshSyncStatus();
  });

  const onOnline = () => {
    refreshSyncStatus();
    void syncNow();
  };
  const onOffline = () => {
    updateStatus({ state: "offline" });
  };
  const onVisibility = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      void syncNow();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
  }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }

  const intervalId = setInterval(() => {
    if (typeof document === "undefined" || document.visibilityState === "visible") {
      void syncNow();
    }
  }, 60000);

  refreshSyncStatus();
  if (getConfig().sheetsEndpoint && getSession()?.token) {
    void syncNow();
  }

  return () => {
    lifecycleInitialized = false;
    unsubStore();
    unsubSession();
    clearInterval(intervalId);
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    clearRetryTimer();
    if (typeof window !== "undefined") {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}
