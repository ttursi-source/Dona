import { hashCodeSync } from "./access";
import {
  CATEGORIES,
  type Category,
  type DonaState,
  type Donor,
  type InventoryItem,
  type ItemCondition,
  type Organization,
  type Sede,
} from "./types";

export const DEMO_CODE = "DEMO01";

export const DEMO_SEDE_COORDS: Record<string, { lat: number; lng: number }> = {
  "caritas-central": { lat: -34.6105, lng: -58.3708 },
  "caritas-san-isidro": { lat: -34.4708, lng: -58.528 },
  "caritas-quilmes": { lat: -34.7206, lng: -58.2546 },
  "caritas-boedo": { lat: -34.6249, lng: -58.4167 },
  "caritas-moron": { lat: -34.6534, lng: -58.6198 },
};

export function buildEmptyState(): DonaState {
  return {
    orgs: [],
    sedes: [],
    donors: [],
    items: [],
    currentSedeId: null,
    meta: { version: 2, lastPull: 0 },
  };
}

function createLcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

interface ItemTemplate {
  name: string;
  category: Category;
  tags: string[];
  unit: string;
  perishable: boolean;
  minQty: number;
  maxQty: number;
}

const TEMPLATES: ItemTemplate[] = [
  { name: "Arroz largo fino 1 kg", category: "Alimentos", tags: ["arroz", "seco", "no perecedero", "canasta básica"], unit: "paquetes", perishable: true, minQty: 12, maxQty: 60 },
  { name: "Fideos guiseros 500 g", category: "Alimentos", tags: ["fideos", "pasta", "seco", "alimentos"], unit: "paquetes", perishable: true, minQty: 15, maxQty: 80 },
  { name: "Leche entera larga vida", category: "Alimentos", tags: ["leche", "lácteo", "desayuno", "infancia"], unit: "litros", perishable: true, minQty: 10, maxQty: 48 },
  { name: "Aceite de girasol 900 ml", category: "Alimentos", tags: ["aceite", "cocina", "canasta básica"], unit: "botellas", perishable: true, minQty: 6, maxQty: 24 },
  { name: "Camperas de abrigo adultos", category: "Ropa y calzado", tags: ["campera", "abrigo", "invierno", "adulto"], unit: "unidades", perishable: false, minQty: 4, maxQty: 20 },
  { name: "Zapatillas infantiles talle 28-34", category: "Ropa y calzado", tags: ["calzado", "zapatillas", "niños", "escolar"], unit: "pares", perishable: false, minQty: 3, maxQty: 15 },
  { name: "Frazadas polares", category: "Ropa y calzado", tags: ["frazada", "abrigo", "invierno", "hogar"], unit: "unidades", perishable: false, minQty: 5, maxQty: 25 },
  { name: "Lavandina 2 L", category: "Higiene y limpieza", tags: ["limpieza", "desinfección", "hogar"], unit: "bidones", perishable: false, minQty: 6, maxQty: 30 },
  { name: "Jabón tocador y shampoo", category: "Higiene y limpieza", tags: ["higiene personal", "aseo", "kit"], unit: "kits", perishable: false, minQty: 10, maxQty: 40 },
  { name: "Pañales descartables talle G", category: "Bebés", tags: ["pañales", "bebé", "primera infancia"], unit: "paquetes", perishable: false, minQty: 6, maxQty: 32 },
  { name: "Leche de fórmula etapa 2", category: "Bebés", tags: ["bebé", "fórmula", "nutrición"], unit: "latas", perishable: true, minQty: 3, maxQty: 14 },
  { name: "Botiquín y gasas estériles", category: "Medicamentos y salud", tags: ["salud", "primeros auxilios", "gasas"], unit: "cajas", perishable: true, minQty: 4, maxQty: 18 },
  { name: "Ibuprofeno y paracetamol 500 mg", category: "Medicamentos y salud", tags: ["analgésico", "medicamentos", "botiquín"], unit: "cajas", perishable: true, minQty: 5, maxQty: 24 },
  { name: "Cuadernos tapa dura y lápices", category: "Útiles escolares", tags: ["útiles", "escolar", "cuadernos", "primaria"], unit: "sets", perishable: false, minQty: 8, maxQty: 35 },
  { name: "Notebooks reacondicionadas", category: "Tecnología", tags: ["notebook", "educación", "computación"], unit: "equipos", perishable: false, minQty: 1, maxQty: 4 },
  { name: "Sillas plásticas apilables", category: "Muebles", tags: ["sillas", "mobiliario", "comedor"], unit: "unidades", perishable: false, minQty: 4, maxQty: 16 },
  { name: "Juegos de mesa y pelotas", category: "Juguetes", tags: ["juguetes", "recreación", "niñez"], unit: "unidades", perishable: false, minQty: 5, maxQty: 22 },
  { name: "Estufa eléctrica cuarzo", category: "Electrodomésticos", tags: ["calefacción", "electrodoméstico", "invierno"], unit: "unidades", perishable: false, minQty: 1, maxQty: 5 },
  { name: "Bolsas de consorcio y cajas", category: "Otros", tags: ["logística", "embalaje", "depósito"], unit: "bultos", perishable: false, minQty: 4, maxQty: 20 },
];

export function buildSeedState(now = new Date()): DonaState {
  const rand = createLcg(20261122);
  const daysAgo = (days: number, hour = 10) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    d.setHours(hour, Math.floor(rand() * 55), 0, 0);
    return d.toISOString();
  };
  const daysAhead = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const orgCreatedAt = daysAgo(180, 9);
  const org: Organization = {
    id: "caritas",
    name: "Cáritas Argentina",
    kind: "red",
    contact: "coordinacion@caritas-ejemplo.org.ar",
    codeHash: hashCodeSync("caritas", DEMO_CODE),
    createdAt: orgCreatedAt,
    updatedAt: orgCreatedAt,
    synced: true,
    demo: true,
  };

  const rawSedes: Array<{
    id: string;
    name: string;
    locality: string;
    manager: string;
    isCentral: boolean;
    joinedAt: string;
  }> = [
    {
      id: "caritas-central",
      name: "Sede Central",
      locality: "CABA",
      manager: "Equipo Nacional",
      isCentral: true,
      joinedAt: daysAgo(180, 9),
    },
    {
      id: "caritas-san-isidro",
      name: "Cáritas San Isidro",
      locality: "San Isidro, GBA Norte",
      manager: "María Laura",
      isCentral: false,
      joinedAt: daysAgo(120, 11),
    },
    {
      id: "caritas-quilmes",
      name: "Cáritas Quilmes",
      locality: "Quilmes, GBA Sur",
      manager: "Tomás R.",
      isCentral: false,
      joinedAt: daysAgo(95, 14),
    },
    {
      id: "caritas-boedo",
      name: "Cáritas Boedo – Parroquia Santa Cruz",
      locality: "Boedo, CABA",
      manager: "Lucía G.",
      isCentral: false,
      joinedAt: daysAgo(62, 16),
    },
    {
      id: "caritas-moron",
      name: "Cáritas Morón",
      locality: "Morón, GBA Oeste",
      manager: "Julián P.",
      isCentral: false,
      joinedAt: daysAgo(40, 10),
    },
  ];

  const sedes: Sede[] = rawSedes.map((s) => ({
    ...s,
    orgId: "caritas",
    updatedAt: s.joinedAt,
    codeHash: hashCodeSync(s.id, DEMO_CODE),
    lat: DEMO_SEDE_COORDS[s.id]?.lat,
    lng: DEMO_SEDE_COORDS[s.id]?.lng,
    active: true,
    synced: true,
    demo: true,
  }));

  const rawDonors: Array<Omit<Donor, "orgId" | "updatedAt" | "synced" | "demo">> = [
    {
      id: "donor-supermercado",
      name: "Supermercado del Barrio S.A.",
      kind: "empresa",
      cuit: "30-71234567-8",
      contact: "rse@superbarrio.example",
      createdAt: daysAgo(110, 10),
    },
    {
      id: "donor-textil",
      name: "Textil Norte S.R.L.",
      kind: "empresa",
      cuit: "30-70987654-3",
      contact: "deposito@textilnorte.example",
      createdAt: daysAgo(88, 12),
    },
    {
      id: "donor-farmacia",
      name: "Farmacia Central",
      kind: "empresa",
      cuit: "30-69456123-1",
      contact: "donaciones@farmaciacentral.example",
      createdAt: daysAgo(70, 15),
    },
    {
      id: "donor-tech",
      name: "Tech Recicla",
      kind: "ong",
      contact: "hola@techrecicla.example",
      createdAt: daysAgo(55, 11),
    },
  ];

  const donors: Donor[] = rawDonors.map((d) => ({
    ...d,
    orgId: "caritas",
    updatedAt: d.createdAt,
    synced: true,
    demo: true,
  }));

  const conditions: ItemCondition[] = ["nuevo", "buen estado", "buen estado", "usado", "a revisar"];
  const activeSedes = sedes.filter((s) => !s.isCentral);
  const items: InventoryItem[] = [];

  for (let i = 0; i < 60; i++) {
    const tpl = TEMPLATES[i % TEMPLATES.length];
    const sede = activeSedes[i % activeSedes.length];
    const ageDays =
      sede.id === "caritas-moron"
        ? 17 + Math.floor(rand() * 68)
        : Math.floor(rand() * 88);
    const qty = tpl.minQty + Math.floor(rand() * (tpl.maxQty - tpl.minQty + 1));
    const fromOrg = rand() < 0.42;
    let donorId: string | null = null;
    if (fromOrg) {
      if (tpl.category === "Alimentos" || tpl.category === "Higiene y limpieza" || tpl.category === "Bebés") {
        donorId = rand() < 0.75 ? "donor-supermercado" : donors[Math.floor(rand() * donors.length)].id;
      } else if (tpl.category === "Ropa y calzado") {
        donorId = "donor-textil";
      } else if (tpl.category === "Medicamentos y salud") {
        donorId = "donor-farmacia";
      } else if (tpl.category === "Tecnología" || tpl.category === "Electrodomésticos") {
        donorId = "donor-tech";
      } else {
        donorId = donors[Math.floor(rand() * donors.length)].id;
      }
    }

    const isDelivered = rand() < 0.24 && ageDays > 3;
    const condition = fromOrg
      ? rand() < 0.7
        ? "nuevo"
        : "buen estado"
      : conditions[Math.floor(rand() * conditions.length)];
    let expiresAt: string | undefined;
    if (tpl.perishable) {
      const offset = i % 19 === 0 && !isDelivered ? 5 + Math.floor(rand() * 8) : 35 + Math.floor(rand() * 180);
      expiresAt = daysAhead(offset);
    }

    const createdAt = daysAgo(ageDays, 9 + Math.floor(rand() * 9));
    const deliveredAt = isDelivered ? daysAgo(Math.max(0, ageDays - (1 + Math.floor(rand() * 4))), 15) : undefined;
    const category: Category = CATEGORIES.includes(tpl.category) ? tpl.category : "Otros";

    items.push({
      id: `DEMO-${String(i + 1).padStart(3, "0")}`,
      orgId: "caritas",
      sedeId: sede.id,
      name: tpl.name,
      category,
      tags: [...tpl.tags],
      quantity: qty,
      unit: tpl.unit,
      condition,
      perishable: tpl.perishable,
      expiresAt,
      donorId,
      status: isDelivered ? "entregado" : "disponible",
      createdAt,
      updatedAt: deliveredAt ?? createdAt,
      deliveredAt,
      aiSource: "manual",
      synced: true,
      demo: true,
    });
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    orgs: [org],
    sedes,
    donors,
    items,
    currentSedeId: null,
    meta: { version: 2, lastPull: 0 },
  };
}
