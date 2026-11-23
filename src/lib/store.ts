import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { hashCodeSync } from "./access";
import { getConfig } from "./config";
import { buildEmptyState, buildSeedState, DEMO_CODE, DEMO_SEDE_COORDS } from "./seed";
import type {
  Category,
  DonaState,
  Donor,
  DonorKind,
  InventoryItem,
  ItemCondition,
  Organization,
  Sede,
} from "./types";

export const STORAGE_KEY = "dona:v2";
export const LEGACY_STORAGE_KEY = "dona:v1";

function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}-${ts}${rand}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

interface LegacyState {
  orgs?: Array<Partial<Organization>>;
  sedes?: Array<Partial<Sede>>;
  donors?: Array<Partial<Donor>>;
  items?: Array<Partial<InventoryItem>>;
  currentSedeId?: string | null;
}

export function migrateV1State(rawV1: LegacyState): DonaState {
  const now = new Date().toISOString();
  const orgs: Organization[] = (rawV1.orgs ?? [])
    .filter((o): o is Partial<Organization> & { id: string; name: string } =>
      Boolean(o.id && o.name)
    )
    .map((o) => ({
      id: o.id,
      name: o.name,
      kind: o.kind === "independiente" ? "independiente" : "red",
      contact: o.contact,
      codeHash:
        o.codeHash || (o.id === "caritas" ? hashCodeSync(o.id, DEMO_CODE) : undefined),
      createdAt: o.createdAt ?? now,
      updatedAt: o.updatedAt ?? o.createdAt ?? now,
      synced: o.synced ?? Boolean(o.demo || o.id === "caritas"),
      deleted: o.deleted,
      demo: o.demo ?? (o.id === "caritas" ? true : undefined),
    }));

  const sedes: Sede[] = (rawV1.sedes ?? [])
    .filter((s): s is Partial<Sede> & { id: string; orgId: string; name: string } =>
      Boolean(s.id && s.orgId && s.name)
    )
    .map((s) => ({
      id: s.id,
      orgId: s.orgId,
      name: s.name,
      locality: s.locality ?? "Argentina",
      manager: s.manager,
      isCentral: Boolean(s.isCentral),
      joinedAt: s.joinedAt ?? now,
      updatedAt: s.updatedAt ?? s.joinedAt ?? now,
      codeHash:
        s.codeHash ||
        (s.demo || s.id.startsWith("caritas-") ? hashCodeSync(s.id, DEMO_CODE) : undefined),
      lat: s.lat ?? DEMO_SEDE_COORDS[s.id]?.lat,
      lng: s.lng ?? DEMO_SEDE_COORDS[s.id]?.lng,
      active: s.active ?? true,
      synced: s.synced ?? Boolean(s.demo),
      deleted: s.deleted,
      demo: s.demo,
    }));

  const donors: Donor[] = (rawV1.donors ?? [])
    .filter((d): d is Partial<Donor> & { id: string; orgId: string; name: string } =>
      Boolean(d.id && d.orgId && d.name)
    )
    .map((d) => ({
      id: d.id,
      orgId: d.orgId,
      name: d.name,
      kind: d.kind ?? "empresa",
      cuit: d.cuit,
      contact: d.contact,
      createdAt: d.createdAt ?? now,
      updatedAt: d.updatedAt ?? d.createdAt ?? now,
      synced: d.synced ?? Boolean(d.demo),
      deleted: d.deleted,
      demo: d.demo,
    }));

  const items: InventoryItem[] = (rawV1.items ?? [])
    .filter((i): i is Partial<InventoryItem> & { id: string; orgId: string; sedeId: string; name: string } =>
      Boolean(i.id && i.orgId && i.sedeId && i.name)
    )
    .map((i) => ({
      id: i.id,
      orgId: i.orgId,
      sedeId: i.sedeId,
      name: i.name,
      category: i.category ?? "Otros",
      tags: Array.isArray(i.tags) ? i.tags : [],
      quantity: typeof i.quantity === "number" ? i.quantity : 1,
      unit: i.unit ?? "unidades",
      condition: i.condition ?? "buen estado",
      perishable: Boolean(i.perishable),
      expiresAt: i.expiresAt,
      donorId: i.donorId ?? null,
      photoThumb: i.photoThumb,
      photoUrl: i.photoUrl,
      notes: i.notes,
      status: i.status === "entregado" ? "entregado" : "disponible",
      createdAt: i.createdAt ?? now,
      updatedAt: i.updatedAt ?? i.deliveredAt ?? i.createdAt ?? now,
      deliveredAt: i.deliveredAt,
      aiSource: i.aiSource === "gemini" ? "gemini" : "manual",
      synced: Boolean(i.synced),
      deleted: i.deleted,
      demo: i.demo,
    }));

  return {
    orgs,
    sedes,
    donors,
    items,
    currentSedeId: rawV1.currentSedeId ?? null,
    meta: { version: 2, lastPull: 0 },
  };
}

function compactPhotos(s: DonaState): DonaState {
  let changed = false;
  const items = s.items.map((item) => {
    if (item.photoThumb && item.photoUrl && item.synced) {
      changed = true;
      const { photoThumb: _drop, ...rest } = item;
      return rest;
    }
    return item;
  });
  if (changed) return { ...s, items };

  // Secondary compaction: drop thumbs on any synced item if quota is still tight
  const items2 = s.items.map((item) => {
    if (item.photoThumb && item.synced) {
      changed = true;
      const { photoThumb: _drop, ...rest } = item;
      return rest;
    }
    return item;
  });
  return changed ? { ...s, items: items2 } : s;
}

function persistState(next: DonaState): DonaState {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch (err) {
    const isQuota =
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED");
    if (isQuota) {
      const compacted = compactPhotos(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(compacted));
        return compacted;
      } catch {
        toast.error("Sin espacio local: sincronizá y borrá fotos viejas");
      }
    }
    return next;
  }
}

function loadState(): DonaState {
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as Partial<DonaState>;
      if (Array.isArray(parsed.orgs) && Array.isArray(parsed.sedes)) {
        return {
          orgs: parsed.orgs,
          sedes: parsed.sedes,
          donors: Array.isArray(parsed.donors) ? parsed.donors : [],
          items: Array.isArray(parsed.items) ? parsed.items : [],
          currentSedeId: parsed.currentSedeId ?? null,
          meta:
            parsed.meta && parsed.meta.version === 2
              ? parsed.meta
              : { version: 2, lastPull: 0 },
        };
      }
    }
  } catch {
    // ignore corrupt v2 and try legacy or seed
  }

  try {
    const rawV1 = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (rawV1) {
      const parsed = JSON.parse(rawV1) as LegacyState;
      if (Array.isArray(parsed.orgs) && parsed.orgs.length > 0) {
        const migrated = migrateV1State(parsed);
        return persistState(migrated);
      }
    }
  } catch {
    // ignore corrupt legacy
  }

  const initial = getConfig().sheetsEndpoint ? buildEmptyState() : buildSeedState();
  return persistState(initial);
}

function deriveVisible(raw: DonaState): DonaState {
  return {
    orgs: raw.orgs.filter((o) => !o.deleted),
    sedes: raw.sedes.filter((s) => !s.deleted),
    donors: raw.donors.filter((d) => !d.deleted),
    items: raw.items.filter((i) => !i.deleted),
    currentSedeId: raw.currentSedeId,
    meta: raw.meta,
  };
}

let state: DonaState = loadState();
let visibleSnapshot: DonaState = deriveVisible(state);
const listeners = new Set<() => void>();

function setState(updater: (prev: DonaState) => DonaState): DonaState {
  const next = updater(state);
  state = persistState(next);
  visibleSnapshot = deriveVisible(state);
  listeners.forEach((fn) => fn());
  return state;
}

export function reloadStoreFromStorage(): DonaState {
  state = loadState();
  visibleSnapshot = deriveVisible(state);
  listeners.forEach((fn) => fn());
  return visibleSnapshot;
}

export function getRawState(): DonaState {
  return state;
}

export function getState(): DonaState {
  return visibleSnapshot;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDona(): DonaState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function hasDemoData(s: DonaState = visibleSnapshot): boolean {
  return (
    s.orgs.some((o) => o.demo && !o.deleted) ||
    s.sedes.some((se) => se.demo && !se.deleted) ||
    s.donors.some((d) => d.demo && !d.deleted) ||
    s.items.some((i) => i.demo && !i.deleted)
  );
}

function mergeSeedById<T extends { id: string; deleted?: boolean }>(
  existing: T[],
  seeded: T[]
): T[] {
  const byId = new Map<string, T>();
  for (const row of existing) {
    byId.set(row.id, row);
  }
  for (const sample of seeded) {
    const prev = byId.get(sample.id);
    if (!prev || prev.deleted) {
      byId.set(sample.id, sample);
    }
  }
  return Array.from(byId.values());
}

export function ensureDemoSeedData(): {
  orgId: string;
  centralSedeId: string;
  affiliatedSedes: Sede[];
} {
  const hasCaritasOrg = visibleSnapshot.orgs.some(
    (o) => o.id === "caritas" && o.demo && !o.deleted
  );
  const hasAffiliatedSede = visibleSnapshot.sedes.some(
    (s) => s.orgId === "caritas" && !s.isCentral && s.active !== false && !s.deleted
  );

  if (!hasCaritasOrg || !hasAffiliatedSede) {
    const seed = buildSeedState();
    setState((prev) => ({
      ...prev,
      orgs: mergeSeedById(prev.orgs, seed.orgs),
      sedes: mergeSeedById(prev.sedes, seed.sedes),
      donors: mergeSeedById(prev.donors, seed.donors),
      items: mergeSeedById(prev.items, seed.items),
    }));
  }

  const affiliatedSedes = visibleSnapshot.sedes.filter(
    (s) => s.orgId === "caritas" && !s.isCentral && s.active !== false
  );
  return {
    orgId: "caritas",
    centralSedeId: "caritas-central",
    affiliatedSedes,
  };
}

export function setCurrentSede(sedeId: string | null): void {
  setState((prev) => ({ ...prev, currentSedeId: sedeId }));
}

export function joinSede(input: {
  id?: string;
  orgId: string;
  name: string;
  locality: string;
  manager?: string;
  codeHash?: string;
  lat?: number;
  lng?: number;
}): Sede {
  const now = new Date().toISOString();
  const slug = slugify(input.name) || "sede";
  const sede: Sede = {
    id: input.id ?? `${input.orgId}-${slug}-${Math.random().toString(36).slice(2, 5)}`,
    orgId: input.orgId,
    name: input.name.trim(),
    locality: input.locality.trim(),
    manager: input.manager?.trim() || undefined,
    isCentral: false,
    joinedAt: now,
    updatedAt: now,
    codeHash: input.codeHash,
    lat: input.lat,
    lng: input.lng,
    active: true,
    synced: false,
  };
  setState((prev) => ({
    ...prev,
    sedes: [...prev.sedes, sede],
    currentSedeId: sede.id,
  }));
  return sede;
}

export function createOrg(input: {
  id?: string;
  orgName: string;
  kind: "red" | "independiente";
  contact?: string;
  codeHash?: string;
  sedeId?: string;
  sedeName: string;
  locality?: string;
  manager?: string;
  centralCodeHash?: string;
  lat?: number;
  lng?: number;
}): { org: Organization; sede: Sede } {
  const now = new Date().toISOString();
  const baseSlug = slugify(input.orgName) || "org";
  const uniqueId =
    input.id ??
    (state.orgs.some((o) => o.id === baseSlug)
      ? `${baseSlug}-${Math.random().toString(36).slice(2, 5)}`
      : baseSlug);

  const org: Organization = {
    id: uniqueId,
    name: input.orgName.trim(),
    kind: input.kind,
    contact: input.contact?.trim() || undefined,
    codeHash: input.codeHash,
    createdAt: now,
    updatedAt: now,
    synced: false,
  };

  const sede: Sede = {
    id: input.sedeId ?? `${org.id}-central`,
    orgId: org.id,
    name: input.sedeName.trim() || "Sede Central",
    locality: input.locality?.trim() || "Argentina",
    manager: input.manager?.trim() || undefined,
    isCentral: true,
    joinedAt: now,
    updatedAt: now,
    codeHash: input.centralCodeHash ?? input.codeHash,
    lat: input.lat,
    lng: input.lng,
    active: true,
    synced: false,
  };

  setState((prev) => ({
    ...prev,
    orgs: [...prev.orgs, org],
    sedes: [...prev.sedes, sede],
    currentSedeId: sede.id,
  }));

  return { org, sede };
}

export function addDonor(input: {
  orgId: string;
  name: string;
  kind: DonorKind;
  cuit?: string;
  contact?: string;
}): Donor {
  const now = new Date().toISOString();
  const donor: Donor = {
    id: makeId("DON"),
    orgId: input.orgId,
    name: input.name.trim(),
    kind: input.kind,
    cuit: input.cuit?.trim() || undefined,
    contact: input.contact?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    synced: false,
  };
  setState((prev) => ({
    ...prev,
    donors: [donor, ...prev.donors],
  }));
  return donor;
}

export function addItem(input: {
  orgId: string;
  sedeId: string;
  name: string;
  category: Category;
  tags: string[];
  quantity: number;
  unit: string;
  condition: ItemCondition;
  perishable: boolean;
  expiresAt?: string;
  donorId: string | null;
  photoThumb?: string;
  photoUrl?: string;
  notes?: string;
  aiSource: "gemini" | "manual";
}): InventoryItem {
  const now = new Date().toISOString();
  const item: InventoryItem = {
    id: makeId("INV"),
    orgId: input.orgId,
    sedeId: input.sedeId,
    name: input.name.trim(),
    category: input.category,
    tags: input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean),
    quantity: Math.max(1, Math.round(input.quantity)),
    unit: input.unit.trim() || "unidades",
    condition: input.condition,
    perishable: input.perishable,
    expiresAt: input.perishable && input.expiresAt ? input.expiresAt : undefined,
    donorId: input.donorId,
    photoThumb: input.photoThumb,
    photoUrl: input.photoUrl,
    notes: input.notes?.trim() || undefined,
    status: "disponible",
    createdAt: now,
    updatedAt: now,
    aiSource: input.aiSource,
    synced: false,
  };
  setState((prev) => ({
    ...prev,
    items: [item, ...prev.items],
  }));
  return item;
}

export function updateItem(
  id: string,
  patch: Partial<Omit<InventoryItem, "id" | "orgId" | "sedeId" | "createdAt">>,
  options: { markUnsynced?: boolean } = {}
): InventoryItem | undefined {
  const { markUnsynced = true } = options;
  const now = new Date().toISOString();
  let updated: InventoryItem | undefined;
  setState((prev) => ({
    ...prev,
    items: prev.items.map((item) => {
      if (item.id !== id) return item;
      const next: InventoryItem = {
        ...item,
        ...patch,
        updatedAt: markUnsynced ? now : patch.updatedAt ?? item.updatedAt,
        synced: markUnsynced ? false : patch.synced ?? item.synced,
      };
      if (next.photoUrl && next.synced) {
        delete next.photoThumb;
      }
      updated = next;
      return next;
    }),
  }));
  return updated;
}

export function deleteItem(id: string): void {
  const now = new Date().toISOString();
  setState((prev) => ({
    ...prev,
    items: prev.items.map((item) =>
      item.id === id
        ? item.demo
          ? { ...item, deleted: true, updatedAt: now, synced: true }
          : { ...item, deleted: true, updatedAt: now, synced: false }
        : item
    ),
  }));
}

export function markDelivered(id: string): InventoryItem | undefined {
  const now = new Date().toISOString();
  return updateItem(id, {
    status: "entregado",
    deliveredAt: now,
    updatedAt: now,
    synced: false,
  });
}

export function deactivateSede(sedeId: string): void {
  const now = new Date().toISOString();
  setState((prev) => ({
    ...prev,
    sedes: prev.sedes.map((s) =>
      s.id === sedeId ? { ...s, active: false, updatedAt: now, synced: false } : s
    ),
    currentSedeId: prev.currentSedeId === sedeId ? null : prev.currentSedeId,
  }));
}

export function updateSedeCodeHash(sedeId: string, codeHash: string): void {
  const now = new Date().toISOString();
  setState((prev) => ({
    ...prev,
    sedes: prev.sedes.map((s) =>
      s.id === sedeId ? { ...s, codeHash, updatedAt: now, synced: false } : s
    ),
  }));
}

export function updateOrgCodeHash(orgId: string, codeHash: string): void {
  const now = new Date().toISOString();
  setState((prev) => ({
    ...prev,
    orgs: prev.orgs.map((o) =>
      o.id === orgId ? { ...o, codeHash, updatedAt: now, synced: false } : o
    ),
  }));
}

export function clearDemoData(): void {
  setState((prev) => {
    const orgs = prev.orgs.filter((o) => !o.demo);
    const sedes = prev.sedes.filter((s) => !s.demo);
    const donors = prev.donors.filter((d) => !d.demo);
    const items = prev.items.filter((i) => !i.demo);
    const validCurrent = sedes.some((s) => s.id === prev.currentSedeId && !s.deleted)
      ? prev.currentSedeId
      : null;
    return {
      ...prev,
      orgs,
      sedes,
      donors,
      items,
      currentSedeId: validCurrent,
    };
  });
}

function lwwMerge<T extends { id: string; updatedAt: string; synced?: boolean; demo?: boolean }>(
  localList: T[],
  remoteList: T[],
  preserveKeys: (keyof T)[] = []
): T[] {
  const byId = new Map<string, T>();
  for (const local of localList) {
    byId.set(local.id, local);
  }
  for (const remote of remoteList) {
    const local = byId.get(remote.id);
    if (!local) {
      byId.set(remote.id, { ...remote, synced: true });
      continue;
    }
    if (local.demo) continue;
    const localWins = local.synced === false && local.updatedAt > remote.updatedAt;
    if (localWins) {
      continue;
    }
    const merged: T = { ...remote, synced: true };
    for (const k of preserveKeys) {
      if (merged[k] === undefined && local[k] !== undefined) {
        merged[k] = local[k];
      }
    }
    byId.set(remote.id, merged);
  }
  return Array.from(byId.values());
}

export function hydratePublic(
  remoteOrgs: Organization[],
  remoteSedes: Sede[]
): void {
  setState((prev) => ({
    ...prev,
    orgs: lwwMerge(prev.orgs, remoteOrgs, ["codeHash"]),
    sedes: lwwMerge(prev.sedes, remoteSedes, ["codeHash"]),
  }));
}

export function mergeRemote(
  data: {
    orgs?: Organization[];
    sedes?: Sede[];
    donors?: Donor[];
    items?: InventoryItem[];
  },
  serverTime?: number
): void {
  setState((prev) => {
    const orgs = data.orgs ? lwwMerge(prev.orgs, data.orgs, ["codeHash"]) : prev.orgs;
    const sedes = data.sedes ? lwwMerge(prev.sedes, data.sedes, ["codeHash"]) : prev.sedes;
    const donors = data.donors ? lwwMerge(prev.donors, data.donors) : prev.donors;
    const rawItems = data.items ? lwwMerge(prev.items, data.items, ["photoThumb"]) : prev.items;
    const items = rawItems
      .map((item) => {
        if (item.photoUrl && item.synced && item.photoThumb) {
          const { photoThumb: _drop, ...rest } = item;
          return rest;
        }
        return item;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      ...prev,
      orgs,
      sedes,
      donors,
      items,
      meta: {
        version: 2,
        lastPull: typeof serverTime === "number" ? serverTime : prev.meta.lastPull,
      },
    };
  });
}

export function markEntitiesSynced(
  ids: {
    orgs?: string[];
    sedes?: string[];
    donors?: string[];
    items?: string[];
  },
  photoUrls: Record<string, string> = {}
): void {
  const orgSet = new Set(ids.orgs ?? []);
  const sedeSet = new Set(ids.sedes ?? []);
  const donorSet = new Set(ids.donors ?? []);
  const itemSet = new Set(ids.items ?? []);

  setState((prev) => ({
    ...prev,
    orgs: prev.orgs.map((o) => (orgSet.has(o.id) ? { ...o, synced: true } : o)),
    sedes: prev.sedes.map((s) => (sedeSet.has(s.id) ? { ...s, synced: true } : s)),
    donors: prev.donors.map((d) => (donorSet.has(d.id) ? { ...d, synced: true } : d)),
    items: prev.items.map((item) => {
      if (!itemSet.has(item.id) && !photoUrls[item.id]) return item;
      const photoUrl = photoUrls[item.id] ?? item.photoUrl;
      const next: InventoryItem = {
        ...item,
        synced: true,
        photoUrl,
      };
      if (next.photoUrl) {
        delete next.photoThumb;
      }
      return next;
    }),
  }));
}
