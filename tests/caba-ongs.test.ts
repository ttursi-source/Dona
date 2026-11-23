import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface CabaOngRecord {
  id: number;
  slug: string;
  name: string;
  zone: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  items: string;
  categories: string[];
  category: string;
  lat: number;
  lng: number;
}

interface CabaDataset {
  generatedAt: string;
  source: string;
  total: number;
  items: CabaOngRecord[];
}

const ALLOWED_CHIPS = new Set([
  "Ropa",
  "Alimentos",
  "Muebles",
  "Salud",
  "Tecnología",
  "Útiles",
  "Bebés",
  "Otros",
]);

describe("CABA organizations dataset (public/data/caba-ongs.json)", () => {
  const datasetPath = path.resolve(import.meta.dirname, "../public/data/caba-ongs.json");
  const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf8")) as CabaDataset;

  it("contains at least 300 real CABA organizations matching total count", () => {
    expect(dataset.total).toBe(dataset.items.length);
    expect(dataset.items.length).toBeGreaterThanOrEqual(300);
  });

  it("has valid unique IDs, non-empty names/addresses/items, and allowed categories", () => {
    const ids = new Set<number>();
    const names = new Set<string>();

    for (const org of dataset.items) {
      expect(ids.has(org.id)).toBe(false);
      ids.add(org.id);

      expect(org.name.trim().length).toBeGreaterThan(1);
      expect(org.name).not.toBe("Quiero Ayudar");
      expect(org.zone.trim().length).toBeGreaterThan(0);
      expect(org.address.trim().length).toBeGreaterThan(2);
      expect(org.items.trim().length).toBeGreaterThan(1);
      expect(Array.isArray(org.categories)).toBe(true);
      expect(org.categories.length).toBeGreaterThan(0);
      expect(ALLOWED_CHIPS.has(org.category)).toBe(true);
      for (const cat of org.categories) {
        expect(ALLOWED_CHIPS.has(cat)).toBe(true);
      }

      names.add(org.name.toLowerCase());
    }
    expect(names.size).toBeGreaterThanOrEqual(300);
  });

  it("places every organization accurately inside CABA geographical bounds", () => {
    for (const org of dataset.items) {
      expect(Number.isFinite(org.lat)).toBe(true);
      expect(Number.isFinite(org.lng)).toBe(true);
      expect(org.lat).toBeGreaterThanOrEqual(-34.72);
      expect(org.lat).toBeLessThanOrEqual(-34.51);
      expect(org.lng).toBeGreaterThanOrEqual(-58.55);
      expect(org.lng).toBeLessThanOrEqual(-58.32);
    }
  });

  it("covers all major donation categories with real organizations", () => {
    for (const cat of ["Ropa", "Alimentos", "Muebles", "Salud", "Tecnología", "Útiles", "Bebés"]) {
      const count = dataset.items.filter((o) => o.categories.includes(cat)).length;
      expect(count).toBeGreaterThan(20);
    }
  });
});
