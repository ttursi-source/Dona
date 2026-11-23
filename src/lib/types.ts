export const CATEGORIES = [
  "Alimentos",
  "Ropa y calzado",
  "Higiene y limpieza",
  "Medicamentos y salud",
  "Muebles",
  "Electrodomésticos",
  "Tecnología",
  "Juguetes",
  "Útiles escolares",
  "Bebés",
  "Otros",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const ITEM_CONDITIONS = [
  "nuevo",
  "buen estado",
  "usado",
  "a revisar",
] as const;

export type ItemCondition = (typeof ITEM_CONDITIONS)[number];

export const DONOR_KINDS = [
  "empresa",
  "ong",
  "gobierno",
  "otro",
] as const;

export type DonorKind = (typeof DONOR_KINDS)[number];

export interface Organization {
  id: string;
  name: string;
  kind: "red" | "independiente";
  contact?: string;
  codeHash?: string;
  createdAt: string;
  updatedAt: string;
  synced?: boolean;
  deleted?: boolean;
  demo?: boolean;
}

export interface Sede {
  id: string;
  orgId: string;
  name: string;
  locality: string;
  manager?: string;
  isCentral: boolean;
  joinedAt: string;
  updatedAt: string;
  codeHash?: string;
  lat?: number;
  lng?: number;
  active: boolean;
  synced?: boolean;
  deleted?: boolean;
  demo?: boolean;
}

export interface Donor {
  id: string;
  orgId: string;
  name: string;
  kind: DonorKind;
  cuit?: string;
  contact?: string;
  createdAt: string;
  updatedAt: string;
  synced?: boolean;
  deleted?: boolean;
  demo?: boolean;
}

export interface InventoryItem {
  id: string;
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
  status: "disponible" | "entregado";
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  aiSource: "gemini" | "manual";
  synced: boolean;
  deleted?: boolean;
  demo?: boolean;
}

export interface DonaMeta {
  version: 2;
  lastPull: number;
}

export interface DonaState {
  orgs: Organization[];
  sedes: Sede[];
  donors: Donor[];
  items: InventoryItem[];
  currentSedeId: string | null;
  meta: DonaMeta;
}

export interface DonaConfig {
  geminiKey: string;
  sheetsEndpoint: string;
  sheetUrl: string;
}

export interface DonaSession {
  role: "sede" | "central";
  orgId: string;
  sedeId?: string;
  token: string;
}

export type PeriodOption = "7 días" | "30 días" | "90 días";
