import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppsScriptHarness } from "../scripts/appsScriptHarness.mjs";
import { csvSafeCell } from "../src/components/ui/glassy-dashboard";
import { hashCode } from "../src/lib/access";

const TINY_JPEG_B64 = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
]).toString("base64");

function installFetchMock(harness: ReturnType<typeof createAppsScriptHarness>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, "http://127.0.0.1:8787");
    const method = (init?.method || "GET").toUpperCase();
    const payload =
      method === "POST"
        ? harness.doPost(typeof init?.body === "string" ? init.body : "{}")
        : harness.doGet(Object.fromEntries(url.searchParams.entries()));

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

describe("two-device sync, photo queue cleanup, and CSV safety", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("syncs org, sede, donor, item + Drive photo from Device A to Device B cleanly", async () => {
    const harness = createAppsScriptHarness({
      properties: { DONA_MOCK_DRIVE_ORIGIN: "http://127.0.0.1:8787" },
    });
    installFetchMock(harness);

    // --- Device A ---
    const configA = await import("../src/lib/config");
    configA.setConfig({ sheetsEndpoint: "http://127.0.0.1:8787/exec" });

    const storeA = await import("../src/lib/store");
    const sessionA = await import("../src/lib/session");
    const photoQueueA = await import("../src/lib/photoQueue");
    const syncA = await import("../src/lib/sync");

    await photoQueueA.clearAllPendingPhotos();
    storeA.clearDemoData();

    const centralCode = "CEN987";
    const orgId = "red-federal";
    const centralHash = await hashCode(orgId, centralCode);
    const { org, sede: centralSede } = storeA.createOrg({
      id: orgId,
      orgName: "Red Federal",
      kind: "red",
      codeHash: centralHash,
      centralCodeHash: centralHash,
      sedeName: "Sede Central Nacional",
      locality: "CABA",
    });

    const regOrg = await syncA.registerOrgRemote(org, centralSede);
    expect(regOrg.ok).toBe(true);

    const sedeCode = "LAN456";
    const sedeId = "sede-lanus";
    const sedeHash = await hashCode(sedeId, sedeCode);
    const localSede = storeA.joinSede({
      id: sedeId,
      orgId,
      name: "Parroquia Lanús",
      locality: "Lanús Oeste",
      lat: -34.707,
      lng: -58.397,
      codeHash: sedeHash,
    });

    const regSede = await syncA.registerSedeRemote(localSede);
    expect(regSede.ok).toBe(true);
    sessionA.signIn({
      role: "sede",
      orgId,
      sedeId: localSede.id,
      token: regSede.token!,
    });

    const donor = storeA.addDonor({
      orgId,
      name: "Panificadora Sur S.A.",
      kind: "empresa",
    });

    const item = storeA.addItem({
      orgId,
      sedeId: localSede.id,
      name: "Paquetes de fideos x 500g",
      category: "Alimentos",
      tags: ["fideos", "seco"],
      quantity: 30,
      unit: "paquetes",
      condition: "nuevo",
      perishable: true,
      expiresAt: "2027-05-01",
      donorId: donor.id,
      photoThumb: "data:image/jpeg;base64,TINYTHUMB",
      aiSource: "gemini",
    });
    await photoQueueA.putPendingPhoto(item.id, `data:image/jpeg;base64,${TINY_JPEG_B64}`);

    const pushRes = await syncA.syncNow();
    expect(pushRes.ok).toBe(true);

    const updatedItemA = storeA.getState().items.find((i) => i.id === item.id);
    expect(updatedItemA?.synced).toBe(true);
    expect(updatedItemA?.photoUrl).toMatch(/^http:\/\/127\.0\.0\.1:8787\/drive\/mock-file-\d+\.jpg\?sz=w400$/);
    expect(updatedItemA?.photoThumb).toBeUndefined();
    expect(await photoQueueA.getPendingPhoto(item.id)).toBeNull();

    // --- Device B (clean browser state) ---
    localStorage.clear();
    await photoQueueA.clearAllPendingPhotos();
    vi.resetModules();

    const configB = await import("../src/lib/config");
    configB.setConfig({ sheetsEndpoint: "http://127.0.0.1:8787/exec" });

    const storeB = await import("../src/lib/store");
    const sessionB = await import("../src/lib/session");
    const syncB = await import("../src/lib/sync");
    const geminiB = await import("../src/lib/gemini");

    const pub = await syncB.fetchPublicSedes();
    expect(pub.ok).toBe(true);
    expect(pub.orgs[0]?.codeHash).toBeUndefined();
    expect(pub.sedes.find((s) => s.id === sedeId)?.codeHash).toBeUndefined();

    const loginB = await syncB.loginRemote({
      role: "central",
      orgId,
      code: centralCode,
    });
    expect(loginB.ok).toBe(true);
    sessionB.signIn({
      role: "central",
      orgId,
      sedeId: loginB.sedeId,
      token: loginB.token!,
    });

    const pullB = await syncB.syncNow();
    expect(pullB.ok).toBe(true);

    const stateB = storeB.getState();
    expect(stateB.sedes.some((s) => s.id === sedeId && s.lat === -34.707)).toBe(true);
    expect(stateB.donors.some((d) => d.name === "Panificadora Sur S.A.")).toBe(true);
    const itemB = stateB.items.find((i) => i.id === item.id);
    expect(itemB?.quantity).toBe(30);
    expect(itemB?.photoUrl).toBe(updatedItemA?.photoUrl);

    const tagRes = await geminiB.tagImage(TINY_JPEG_B64);
    expect(tagRes.categoria).toBe("Alimentos");
    expect(tagRes.nombre).toContain("fideos");
  });

  it("escapes CSV formula prefixes on strings while keeping numbers unquoted as formulas", () => {
    expect(csvSafeCell("=CMD('calc')")).toBe(`"'=CMD('calc')"`);
    expect(csvSafeCell("+SUM(A1)")).toBe(`"'+SUM(A1)"`);
    expect(csvSafeCell("-1+1")).toBe(`"'-1+1"`);
    expect(csvSafeCell("@IMPORTXML")).toBe(`"'@IMPORTXML"`);
    expect(csvSafeCell("\tcmd")).toBe(`"'\tcmd"`);
    expect(csvSafeCell(-5)).toBe(`"-5"`);
    expect(csvSafeCell(`Texto con "comillas"`)).toBe(`"Texto con ""comillas"""`);
  });
});
