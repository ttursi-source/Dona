import { describe, expect, it } from "vitest";
import { createAppsScriptHarness } from "../scripts/appsScriptHarness.mjs";
import { hashCodeSync } from "../src/lib/access";

const TINY_JPEG_B64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]).toString(
  "base64"
);

function seedOrgAndTwoSedes(harness: ReturnType<typeof createAppsScriptHarness>) {
  const centralHash = hashCodeSync("red-solidaria", "CEN123");
  const regOrg = harness.doPost({
    action: "registerOrg",
    org: {
      id: "red-solidaria",
      name: "Red Solidaria",
      kind: "red",
      codeHash: centralHash,
      createdAt: "2026-11-20T10:00:00.000Z",
      updatedAt: "2026-11-20T10:00:00.000Z",
    },
    centralSede: {
      id: "red-solidaria-central",
      orgId: "red-solidaria",
      name: "Sede Central",
      locality: "CABA",
      isCentral: true,
      codeHash: centralHash,
      joinedAt: "2026-11-20T10:00:00.000Z",
      updatedAt: "2026-11-20T10:00:00.000Z",
      active: true,
    },
  });
  expect(regOrg.ok).toBe(true);

  const sedeAHash = hashCodeSync("sede-almagro", "ALM111");
  const regA = harness.doPost({
    action: "registerSede",
    sede: {
      id: "sede-almagro",
      orgId: "red-solidaria",
      name: "Parroquia Almagro",
      locality: "Almagro",
      isCentral: false,
      codeHash: sedeAHash,
      lat: -34.607,
      lng: -58.42,
      joinedAt: "2026-11-20T10:05:00.000Z",
      updatedAt: "2026-11-20T10:05:00.000Z",
      active: true,
    },
  });
  expect(regA.ok).toBe(true);

  const sedeBHash = hashCodeSync("sede-flores", "FLO222");
  const regB = harness.doPost({
    action: "registerSede",
    sede: {
      id: "sede-flores",
      orgId: "red-solidaria",
      name: "Comedor Flores",
      locality: "Flores",
      isCentral: false,
      codeHash: sedeBHash,
      joinedAt: "2026-11-20T10:06:00.000Z",
      updatedAt: "2026-11-20T10:06:00.000Z",
      active: true,
    },
  });
  expect(regB.ok).toBe(true);

  return {
    centralToken: regOrg.token as string,
    sedeAToken: regA.token as string,
    sedeBToken: regB.token as string,
  };
}

describe("Apps Script Code.gs backend", () => {
  it("strips codeHash from publicSedes and hides deactivated sedes", () => {
    const harness = createAppsScriptHarness();
    const { centralToken } = seedOrgAndTwoSedes(harness);

    // Central deactivates sede-flores
    const deact = harness.doPost({
      action: "sync",
      token: centralToken,
      since: 0,
      sedes: [
        {
          id: "sede-flores",
          orgId: "red-solidaria",
          name: "Comedor Flores",
          locality: "Flores",
          isCentral: false,
          active: false,
          joinedAt: "2026-11-20T10:06:00.000Z",
          updatedAt: "2026-11-20T12:00:00.000Z",
        },
      ],
    });
    expect(deact.ok).toBe(true);

    const pub = harness.doGet({ action: "publicSedes" });
    expect(pub.ok).toBe(true);
    expect(pub.orgs).toHaveLength(1);
    expect(pub.orgs[0].codeHash).toBeUndefined();
    const sedeIds = pub.sedes.map((s: { id: string; codeHash?: string }) => {
      expect(s.codeHash).toBeUndefined();
      return s.id;
    });
    expect(sedeIds).toContain("sede-almagro");
    expect(sedeIds).not.toContain("sede-flores");
  });

  it("locks out after 5 wrong login attempts for 10 minutes", () => {
    const harness = createAppsScriptHarness();
    seedOrgAndTwoSedes(harness);
    const wrongHash = hashCodeSync("sede-almagro", "WRONG1");
    const goodHash = hashCodeSync("sede-almagro", "ALM111");

    for (let i = 1; i <= 4; i++) {
      const res = harness.doPost({
        action: "login",
        role: "sede",
        orgId: "red-solidaria",
        sedeId: "sede-almagro",
        codeHash: wrongHash,
      });
      expect(res.ok).toBe(false);
      expect(res.locked).toBe(false);
      expect(res.remainingAttempts).toBe(5 - i);
    }

    const fifth = harness.doPost({
      action: "login",
      role: "sede",
      orgId: "red-solidaria",
      sedeId: "sede-almagro",
      codeHash: wrongHash,
    });
    expect(fifth.ok).toBe(false);
    expect(fifth.locked).toBe(true);

    // Even correct code is blocked while locked
    const duringLock = harness.doPost({
      action: "login",
      role: "sede",
      orgId: "red-solidaria",
      sedeId: "sede-almagro",
      codeHash: goodHash,
    });
    expect(duringLock.ok).toBe(false);
    expect(duringLock.locked).toBe(true);

    // After 10+ minutes, login succeeds again
    harness.advanceTimeMs(605 * 1000);
    const recovered = harness.doPost({
      action: "login",
      role: "sede",
      orgId: "red-solidaria",
      sedeId: "sede-almagro",
      codeHash: goodHash,
    });
    expect(recovered.ok).toBe(true);
    expect(typeof recovered.token).toBe("string");
  });

  it("enforces sede scope restrictions and blocks deactivated sedes on sync", () => {
    const harness = createAppsScriptHarness();
    const { centralToken, sedeAToken, sedeBToken } = seedOrgAndTwoSedes(harness);

    // Sede A attempts to overwrite orgs, modify Sede B, and insert item under Sede B
    const abuseSync = harness.doPost({
      action: "sync",
      token: sedeAToken,
      since: 0,
      orgs: [{ id: "red-solidaria", name: "Hacked", kind: "red", updatedAt: "2026-11-22T00:00:00Z" }],
      sedes: [{ id: "sede-flores", orgId: "red-solidaria", name: "Fake", locality: "X", updatedAt: "2026-11-22T00:00:00Z" }],
      items: [
        {
          id: "INV-CROSS",
          orgId: "red-solidaria",
          sedeId: "sede-flores",
          name: "Item ajeno",
          category: "Otros",
          tags: [],
          quantity: 1,
          unit: "u",
          condition: "nuevo",
          perishable: false,
          donorId: null,
          status: "disponible",
          createdAt: "2026-11-22T00:00:00Z",
          updatedAt: "2026-11-22T00:00:00Z",
          aiSource: "manual",
        },
      ],
    });
    expect(abuseSync.ok).toBe(true);
    expect(abuseSync.rejectedIds.orgs).toContain("red-solidaria");
    expect(abuseSync.rejectedIds.sedes).toContain("sede-flores");
    expect(abuseSync.rejectedIds.items).toContain("INV-CROSS");
    expect(abuseSync.pull.orgs[0].name).toBe("Red Solidaria");

    // Central deactivates sede-flores -> Sede B sync must now fail unauthorized
    harness.doPost({
      action: "sync",
      token: centralToken,
      sedes: [
        {
          id: "sede-flores",
          orgId: "red-solidaria",
          name: "Comedor Flores",
          locality: "Flores",
          isCentral: false,
          active: false,
          joinedAt: "2026-11-20T10:06:00.000Z",
          updatedAt: "2026-11-22T01:00:00.000Z",
        },
      ],
    });

    const rejectedB = harness.doPost({
      action: "sync",
      token: sedeBToken,
      since: 0,
    });
    expect(rejectedB.ok).toBe(false);
    expect(rejectedB.unauthorized).toBe(true);
  });

  it("uploads Drive photos, applies LWW merge, and neutralizes spreadsheet formula injection", () => {
    const harness = createAppsScriptHarness({
      properties: { DONA_MOCK_DRIVE_ORIGIN: "http://127.0.0.1:8787" },
    });
    const { sedeAToken } = seedOrgAndTwoSedes(harness);

    const push = harness.doPost({
      action: "sync",
      token: sedeAToken,
      since: 0,
      donors: [
        {
          id: "DON-INJ",
          orgId: "red-solidaria",
          name: "+SUM(A1:A9)",
          kind: "empresa",
          createdAt: "2026-11-21T10:00:00Z",
          updatedAt: "2026-11-21T10:00:00Z",
        },
      ],
      items: [
        {
          id: "INV-PHOTO-1",
          orgId: "red-solidaria",
          sedeId: "sede-almagro",
          name: "=HYPERLINK(\"http://evil\", \"Click\")",
          category: "Alimentos",
          tags: ["lata"],
          quantity: 4,
          unit: "latas",
          condition: "nuevo",
          perishable: false,
          donorId: "DON-INJ",
          photoThumb: "data:image/jpeg;base64,INLINE",
          status: "disponible",
          createdAt: "2026-11-21T10:00:00Z",
          updatedAt: "2026-11-21T10:00:00Z",
          aiSource: "manual",
        },
      ],
      photos: {
        "INV-PHOTO-1": `data:image/jpeg;base64,${TINY_JPEG_B64}`,
      },
    });

    expect(push.ok).toBe(true);
    expect(push.photoUrls["INV-PHOTO-1"]).toMatch(/^http:\/\/127\.0\.0\.1:8787\/drive\/mock-file-\d+\.jpg\?sz=w400$/);

    // Check Spreadsheet columns sanitize leading = and + while keeping _json accurate
    const invRows = harness.getSheetValues("Inventario");
    const row = invRows[1];
    expect(String(row[4])).toMatch(/^'=HYPERLINK/);
    expect(String(row[12])).toMatch(/^'\+SUM/);
    expect(String(row[14])).toContain("/drive/mock-file-");

    // Stale LWW update must be ignored
    const stale = harness.doPost({
      action: "sync",
      token: sedeAToken,
      since: 0,
      items: [
        {
          id: "INV-PHOTO-1",
          orgId: "red-solidaria",
          sedeId: "sede-almagro",
          name: "Stale override",
          category: "Alimentos",
          tags: [],
          quantity: 1,
          unit: "latas",
          condition: "usado",
          perishable: false,
          donorId: null,
          status: "disponible",
          createdAt: "2026-11-21T10:00:00Z",
          updatedAt: "2026-11-21T09:00:00Z",
          aiSource: "manual",
        },
      ],
    });
    expect(stale.pull.items.find((i: { id: string }) => i.id === "INV-PHOTO-1").quantity).toBe(4);
  });

  it("allows central code rotation and enforces tag proxy rate limits", () => {
    const harness = createAppsScriptHarness();
    const { centralToken } = seedOrgAndTwoSedes(harness);

    const newHash = hashCodeSync("sede-almagro", "NEW789");
    const rot = harness.doPost({
      action: "rotateCode",
      token: centralToken,
      orgId: "red-solidaria",
      targetType: "sede",
      targetId: "sede-almagro",
      newCodeHash: newHash,
    });
    expect(rot.ok).toBe(true);

    // Old code fails, new code works
    expect(
      harness.doPost({
        action: "login",
        role: "sede",
        orgId: "red-solidaria",
        sedeId: "sede-almagro",
        codeHash: hashCodeSync("sede-almagro", "ALM111"),
      }).ok
    ).toBe(false);

    expect(
      harness.doPost({
        action: "login",
        role: "sede",
        orgId: "red-solidaria",
        sedeId: "sede-almagro",
        codeHash: newHash,
      }).ok
    ).toBe(true);

    // Public tag rate limit = 20/min
    for (let i = 0; i < 20; i++) {
      const res = harness.doPost({
        action: "tag",
        mode: "public",
        clientKey: "map-user-1",
        photoBase64: TINY_JPEG_B64,
      });
      expect(res.ok).toBe(true);
    }
    const blocked = harness.doPost({
      action: "tag",
      mode: "public",
      clientKey: "map-user-1",
      photoBase64: TINY_JPEG_B64,
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.rateLimited).toBe(true);
  });
});
