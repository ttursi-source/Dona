import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DonaState, InventoryItem } from "../src/lib/types";

describe("dona:v2 store migration, LWW sync, tombstones and quota recovery", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("migrates legacy dona:v1 state to dona:v2 preserving records and hashing legacy demo codes", async () => {
    localStorage.setItem(
      "dona:v1",
      JSON.stringify({
        orgs: [{ id: "caritas", name: "Cáritas Argentina", kind: "red", createdAt: "2026-01-01T00:00:00Z" }],
        sedes: [
          {
            id: "caritas-central",
            orgId: "caritas",
            name: "Sede Central",
            locality: "CABA",
            isCentral: true,
            joinedAt: "2026-01-01T00:00:00Z",
          },
        ],
        donors: [],
        items: [
          {
            id: "INV-LEG-1",
            orgId: "caritas",
            sedeId: "caritas-central",
            name: "Fideos x 20",
            category: "Alimentos",
            tags: ["fideos"],
            quantity: 20,
            unit: "paquetes",
            condition: "nuevo",
            perishable: false,
            donorId: null,
            status: "disponible",
            createdAt: "2026-01-02T00:00:00Z",
            aiSource: "manual",
            synced: true,
          },
        ],
        currentSedeId: "caritas-central",
      })
    );

    const store = await import("../src/lib/store");
    const state = store.getState();

    expect(state.meta.version).toBe(2);
    expect(state.orgs[0]?.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(state.sedes[0]?.active).toBe(true);
    expect(state.sedes[0]?.updatedAt).toBe("2026-01-01T00:00:00Z");
    expect(state.items[0]?.id).toBe("INV-LEG-1");
    expect(localStorage.getItem("dona:v2")).toBeTruthy();
  });

  it("hides deleted tombstones in getState() while preserving them in getRawState()", async () => {
    const store = await import("../src/lib/store");
    const created = store.addItem({
      orgId: "caritas",
      sedeId: "caritas-boedo",
      name: "Yerba x 10",
      category: "Alimentos",
      tags: ["yerba"],
      quantity: 10,
      unit: "kg",
      condition: "nuevo",
      perishable: false,
      donorId: null,
      aiSource: "manual",
    });

    expect(store.getState().items.some((i) => i.id === created.id)).toBe(true);
    store.deleteItem(created.id);

    expect(store.getState().items.some((i) => i.id === created.id)).toBe(false);
    const raw = store.getRawState().items.find((i) => i.id === created.id);
    expect(raw?.deleted).toBe(true);
    expect(raw?.synced).toBe(false);
  });

  it("protects newer unsynced local changes during mergeRemote LWW and strips redundant photoThumb", async () => {
    const store = await import("../src/lib/store");
    store.clearDemoData();
    const { org, sede } = store.createOrg({
      id: "red-sur",
      orgName: "Red Sur",
      kind: "red",
      sedeName: "Central Sur",
    });

    const item = store.addItem({
      orgId: org.id,
      sedeId: sede.id,
      name: "Frazadas nuevas",
      category: "Ropa y calzado",
      tags: ["abrigo"],
      quantity: 12,
      unit: "unidades",
      condition: "nuevo",
      perishable: false,
      donorId: null,
      photoThumb: "data:image/jpeg;base64,SMALL",
      aiSource: "manual",
    });

    // Older remote update must NOT overwrite newer unsynced local state
    const olderTs = new Date(Date.now() - 60000).toISOString();
    const olderRemote: InventoryItem = {
      ...item,
      quantity: 2,
      updatedAt: olderTs,
      synced: true,
    };
    store.mergeRemote({ items: [olderRemote] }, 100);
    expect(store.getState().items.find((i) => i.id === item.id)?.quantity).toBe(12);

    // Newer remote update with Drive photoUrl replaces quantity and drops photoThumb
    const newerTs = new Date(Date.now() + 60000).toISOString();
    const newerRemote: InventoryItem = {
      ...item,
      quantity: 25,
      photoUrl: "https://drive.google.com/thumbnail?id=abc&sz=w400",
      updatedAt: newerTs,
      synced: true,
    };
    store.mergeRemote({ items: [newerRemote] }, 200);
    const merged = store.getState().items.find((i) => i.id === item.id);
    expect(merged?.quantity).toBe(25);
    expect(merged?.photoUrl).toContain("id=abc");
    expect(merged?.photoThumb).toBeUndefined();
    expect(store.getState().meta.lastPull).toBe(200);
  });

  it("compacts synced photoThumbs when localStorage throws QuotaExceededError", async () => {
    const store = await import("../src/lib/store");
    store.clearDemoData();
    const { org, sede } = store.createOrg({
      id: "red-quota",
      orgName: "Red Quota",
      kind: "independiente",
      sedeName: "Central",
    });

    const syncedItem = store.addItem({
      orgId: org.id,
      sedeId: sede.id,
      name: "Lote ya subido",
      category: "Alimentos",
      tags: [],
      quantity: 5,
      unit: "cajas",
      condition: "nuevo",
      perishable: false,
      donorId: null,
      photoThumb: "data:image/jpeg;base64,HEAVYTHUMB",
      photoUrl: "https://drive.google.com/thumbnail?id=xyz&sz=w400",
      aiSource: "manual",
    });
    // Force a synced item that still retains a photoThumb in raw state
    store.updateItem(syncedItem.id, { photoThumb: "data:image/jpeg;base64,HEAVY", synced: true }, { markUnsynced: false });

    const origSetItem = Storage.prototype.setItem;
    let calls = 0;
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      k: string,
      v: string
    ) {
      calls += 1;
      if (k === "dona:v2" && calls === 1) {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      }
      return origSetItem.call(this, k, v);
    });

    store.addItem({
      orgId: org.id,
      sedeId: sede.id,
      name: "Lote nuevo local",
      category: "Ropa y calzado",
      tags: [],
      quantity: 3,
      unit: "bolsas",
      condition: "buen estado",
      perishable: false,
      donorId: null,
      photoThumb: "data:image/jpeg;base64,LOCALKEEP",
      aiSource: "manual",
    });

    spy.mockRestore();
    const after = store.getState();
    expect(after.items.find((i) => i.id === syncedItem.id)?.photoThumb).toBeUndefined();
    expect(after.items.find((i) => i.name === "Lote nuevo local")?.photoThumb).toBe(
      "data:image/jpeg;base64,LOCALKEEP"
    );
  });

  it("clears demo entities via clearDemoData without deleting real orgs", async () => {
    const store = await import("../src/lib/store");
    expect(store.hasDemoData()).toBe(true);

    const { org, sede } = store.createOrg({
      id: "fundacion-real",
      orgName: "Fundación Real",
      kind: "independiente",
      sedeName: "Central",
    });
    store.addItem({
      orgId: org.id,
      sedeId: sede.id,
      name: "Leche real",
      category: "Alimentos",
      tags: [],
      quantity: 4,
      unit: "litros",
      condition: "nuevo",
      perishable: true,
      donorId: null,
      aiSource: "manual",
    });

    store.clearDemoData();
    const after: DonaState = store.getState();
    expect(store.hasDemoData(after)).toBe(false);
    expect(after.orgs.map((o) => o.id)).toEqual(["fundacion-real"]);
    expect(after.items.map((i) => i.name)).toEqual(["Leche real"]);
  });
});
