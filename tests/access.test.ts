import { describe, expect, it } from "vitest";
import {
  formatCode,
  generateCode,
  hashCode,
  hashCodeSync,
  normalizeCode,
  sha256Hex,
  sha256Sync,
} from "../src/lib/access";

describe("access codes and hashing", () => {
  it("normalizes and formats codes cleanly", () => {
    expect(normalizeCode(" abc-123 ")).toBe("ABC123");
    expect(normalizeCode("demo01")).toBe("DEMO01");
    expect(formatCode("abc123")).toBe("ABC-123");
    expect(formatCode("ab-c9")).toBe("ABC-9");
    expect(formatCode("a")).toBe("A");
  });

  it("generates unambiguous 6-character codes without 0/O/1/I", () => {
    for (let i = 0; i < 40; i++) {
      const code = generateCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      expect(code).not.toMatch(/[0O1I]/);
    }
  });

  it("produces identical SHA-256 hashes between pure-JS sync and WebCrypto async", async () => {
    const syncEmpty = sha256Sync("");
    const asyncEmpty = await sha256Hex("");
    expect(syncEmpty).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    expect(asyncEmpty).toBe(syncEmpty);

    const scopedSync = hashCodeSync("caritas-boedo", "ab-c92k");
    const scopedAsync = await hashCode("caritas-boedo", "ABC92K");
    expect(scopedSync).toBe(scopedAsync);
    expect(scopedSync).toMatch(/^[0-9a-f]{64}$/);
  });

  it("salts hashes by scopeId so identical codes in different scopes differ", () => {
    const h1 = hashCodeSync("sede-1", "DEMO01");
    const h2 = hashCodeSync("sede-2", "DEMO01");
    expect(h1).not.toBe(h2);
  });
});
