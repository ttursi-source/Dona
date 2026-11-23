import type { Category } from "./types";

interface CategoryRule {
  category: Category;
  pattern: RegExp;
  tags: string[];
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "Bebés",
    pattern:
      /\b(panal|panales|bebe|bebes|mamadera|mamaderas|chupete|chupetes|cochecito|cuna|practicuna|portabebe|ranita|body|enterito|maternizada|formula infantil|leche de formula|oleo calcareo)\b/,
    tags: ["bebés", "primera infancia"],
  },
  {
    category: "Medicamentos y salud",
    pattern:
      /\b(ibuprofeno|paracetamol|aspirina|amoxicilina|gasa|gasas|venda|vendas|curita|curitas|botiquin|medicamento|medicamentos|remedio|remedios|jarabe|termometro|tensiometro|jeringa|suero|barbijo|barbijos|agua oxigenada|pervinox|antiseptico|salud|farmacia|antipiretico|vitamina|vitaminas|alcohol en gel)\b/,
    tags: ["salud", "botiquín"],
  },
  {
    category: "Higiene y limpieza",
    pattern:
      /\b(lavandina|jabon|jabones|shampoo|champu|acondicionador|detergente|limpieza|higiene|desinfectante|esponja|esponjas|trapo|escoba|balde|dentifrico|pasta dental|cepillo de dientes|desodorante|papel higienico|rollo de cocina|servilleta|servilletas|toallita|toallitas|aseo|cloro|alcohol)\b/,
    tags: ["higiene", "limpieza", "hogar"],
  },
  {
    category: "Alimentos",
    pattern:
      /\b(arroz|fideo|fideos|pasta|pastas|leche|aceite|azucar|yerba|harina|polenta|lata|latas|conserva|atun|pure|tomate|lenteja|lentejas|poroto|porotos|garbanzo|garbanzos|galletita|galletitas|pan|mate|cafe|cacao|alimento|alimentos|comida|mercaderia|vianda|caldo|salsa|mermelada|dulce|sal|vinagre|agua mineral|jugo|te)\b/,
    tags: ["alimentos", "canasta básica", "no perecedero"],
  },
  {
    category: "Ropa y calzado",
    pattern:
      /\b(abrigo|abrigos|campera|camperas|buzo|buzos|remera|remeras|pantalon|pantalones|jean|jeans|pulover|pullover|sueter|sweater|ropa|indumentaria|vestimenta|zapatilla|zapatillas|zapato|zapatos|bota|botas|ojota|ojotas|sandalia|sandalias|calzado|medias|camisa|camisas|bufanda|bufandas|gorro|gorros|guante|guantes|frazada|frazadas|manta|mantas|sabana|sabanas|acolchado|acolchados|toalla|toallas|chomba|pollera|vestido|camperita)\b/,
    tags: ["indumentaria", "abrigo", "textil"],
  },
  {
    category: "Útiles escolares",
    pattern:
      /\b(cuaderno|cuadernos|lapiz|lapices|lapicera|lapiceras|birome|biromes|mochila|mochilas|cartuchera|cartucheras|carpeta|carpetas|hojas|repuesto|regla|goma|sacapuntas|tijera|plasticola|adhesivo|fibron|fibrones|marcador|marcadores|temperas|acrilico|util|utiles|escolar|escolares|libro|libros|manual|diccionario|crayon|crayones)\b/,
    tags: ["útiles", "escolar"],
  },
  {
    category: "Tecnología",
    pattern:
      /\b(notebook|notebooks|netbook|computadora|computadoras|pc|laptop|tablet|tablets|celular|celulares|telefono|teclado|mouse|monitor|monitores|impresora|router|pendrive|cargador|cable|auriculares|tecnologia|informatica)\b/,
    tags: ["tecnología", "educación"],
  },
  {
    category: "Electrodomésticos",
    pattern:
      /\b(estufa|estufas|calefactor|calefactores|ventilador|ventiladores|heladera|freezer|microondas|pava|horno|anafe|lavarropas|plancha|licuadora|tostadora|electrodomestico|electrodomesticos|calefaccion)\b/,
    tags: ["electrodomésticos", "hogar"],
  },
  {
    category: "Muebles",
    pattern:
      /\b(silla|sillas|mesa|mesas|cama|camas|mueble|muebles|colchon|colchones|placard|ropero|comoda|escritorio|sillon|sillones|sofa|estanteria|biblioteca|banqueta|mobiliario)\b/,
    tags: ["mobiliario", "hogar"],
  },
  {
    category: "Juguetes",
    pattern:
      /\b(juguete|juguetes|pelota|pelotas|muneca|munecas|muneco|peluche|peluches|rompecabezas|puzzle|lego|bloques|autito|autitos|bicicleta|triciclo|monopatin|juego de mesa|metegol|recreacion)\b/,
    tags: ["juguetes", "niñez"],
  },
  {
    category: "Otros",
    pattern:
      /\b(bolsa|bolsas|caja|cajas|bulto|bultos|pallet|herramienta|herramientas|martillo|destornillador|pintura|embalaje|varios)\b/,
    tags: ["logística", "varios"],
  },
];

export function inferCategory(name: string): Category | null {
  const clean = normalizeText(name);
  if (!clean) return null;

  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(clean)) {
      return rule.category;
    }
  }
  return null;
}

export function suggestTags(name: string, category?: Category | ""): string[] {
  const clean = normalizeText(name);
  const found = new Set<string>();

  if (category) {
    const byCat = CATEGORY_RULES.find((r) => r.category === category);
    byCat?.tags.forEach((t) => found.add(t));
  }

  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(clean)) {
      rule.tags.forEach((t) => found.add(t));
    }
  }

  const words = clean
    .split(" ")
    .filter((w) => w.length >= 4)
    .slice(0, 3);
  words.forEach((w) => found.add(w));

  return Array.from(found).slice(0, 6);
}
