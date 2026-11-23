import { describe, expect, it } from "vitest";
import { inferCategory, suggestTags } from "../src/lib/classify";
import type { Category } from "../src/lib/types";

describe("donation category inference (inferCategory)", () => {
  const cases: Array<[string, Category]> = [
    // Alimentos (incl. Argentine staples)
    ["Paquete de fideos tirabuzón x 500g", "Alimentos"],
    ["Yerba mate suave 1kg", "Alimentos"],
    ["Polenta instantánea x 12", "Alimentos"],
    ["Leche larga vida entera", "Alimentos"],
    ["Arroz largo fino 1kg", "Alimentos"],
    ["Galletitas dulces surtidas", "Alimentos"],
    ["Aceite de girasol 1.5L", "Alimentos"],
    // Ropa y calzado
    ["Campera de abrigo talle M", "Ropa y calzado"],
    ["Zapatillas deportivas nro 38", "Ropa y calzado"],
    ["Frazada polar doble plaza", "Ropa y calzado"],
    ["Pulóver de lana gris", "Ropa y calzado"],
    ["Jeans y buzos usados", "Ropa y calzado"],
    // Higiene y limpieza
    ["Bidón de lavandina 5L", "Higiene y limpieza"],
    ["Jabón de tocador x 6 unidades", "Higiene y limpieza"],
    ["Shampoo familiar 750ml", "Higiene y limpieza"],
    ["Papel higiénico por 12 rollos", "Higiene y limpieza"],
    ["Dentífrico y cepillo de dientes", "Higiene y limpieza"],
    // Medicamentos y salud
    ["Caja de ibuprofeno 400mg", "Medicamentos y salud"],
    ["Botiquín de primeros auxilios con gasas", "Medicamentos y salud"],
    ["Alcohol en gel 500ml", "Medicamentos y salud"],
    ["Termómetro digital clínico", "Medicamentos y salud"],
    // Muebles
    ["Silla de madera reforzada", "Muebles"],
    ["Colchón de 1 plaza", "Muebles"],
    ["Mesa comedor rectangular", "Muebles"],
    // Electrodomésticos
    ["Estufa eléctrica de cuarzo", "Electrodomésticos"],
    ["Heladera con freezer usada", "Electrodomésticos"],
    ["Ventilador de pie", "Electrodomésticos"],
    // Tecnología
    ["Notebook reciclada para escuela", "Tecnología"],
    ["Monitor LED 22 pulgadas", "Tecnología"],
    ["Router Wi-Fi doble banda", "Tecnología"],
    // Juguetes
    ["Pelota de fútbol nro 5", "Juguetes"],
    ["Muñecas y peluches lavados", "Juguetes"],
    ["Rompecabezas infantil 100 piezas", "Juguetes"],
    // Útiles escolares
    ["Mochila escolar con cartuchera", "Útiles escolares"],
    ["Cuaderno tapa dura 100 hojas", "Útiles escolares"],
    ["Lápices de colores y biromes", "Útiles escolares"],
    // Bebés (debe ganar por sobre Alimentos cuando aparece leche maternizada o pañales)
    ["Pañales talle G x 48", "Bebés"],
    ["Leche de fórmula infantil 0-6 meses", "Bebés"],
    ["Mamadera y chupete silicona", "Bebés"],
    ["Cochecito paragüitas", "Bebés"],
    // Otros
    ["Cajas de embalaje vacías", "Otros"],
    ["Herramientas variadas y martillo", "Otros"],
  ];

  it.each(cases)("infers %s -> %s", (name, expected) => {
    expect(inferCategory(name)).toBe(expected);
  });

  it("strips accents and handles mixed casing", () => {
    expect(inferCategory("PANALES BEBE TALLE P")).toBe("Bebés");
    expect(inferCategory("ÚTILES ESCOLARES Y LAPICES")).toBe("Útiles escolares");
    expect(inferCategory("ÁZUCAR Y CAFÉ MOLIDO")).toBe("Alimentos");
  });

  it("returns null for unknown or empty inputs instead of guessing Alimentos", () => {
    expect(inferCategory("")).toBeNull();
    expect(inferCategory("Donación anónima lote #44")).toBeNull();
    expect(inferCategory("Artículo sin especificar")).toBeNull();
  });

  it("builds unique Spanish tags via suggestTags", () => {
    const tags = suggestTags("Campera de abrigo invernal", "Ropa y calzado");
    expect(tags.length).toBeGreaterThan(0);
    expect(tags.length).toBeLessThanOrEqual(6);
    expect(new Set(tags).size).toBe(tags.length);
  });
});
