import { suggestTags } from "./classify";
import { getConfig } from "./config";
import { normalizeGeminiResult, type GeminiTagResult } from "./geminiNormalize";
import { getSession } from "./session";
import { tagImageViaProxy } from "./sync";
import { CATEGORIES, ITEM_CONDITIONS, type Category } from "./types";

export { normalizeGeminiResult, type GeminiTagResult };

const PROMPT = `Sos un asistente de inventario de una ONG argentina (como Cáritas).
Analizá la foto de esta donación y devolvé los datos estructurados en español rioplatense.
Reglas:
- "nombre": nombre corto y claro del producto o prenda (ej: "Paquetes de fideos 500 g", "Campera de abrigo talle M").
- "categoria": elegí exactamente una de la lista permitida; si no encaja, usá "Otros".
- "etiquetas": entre 3 y 6 tags en minúsculas útiles para buscar (ej: ["fideos", "seco", "alimentos", "no perecedero"]).
- "cantidad_estimada": cantidad entera de unidades visibles (mínimo 1).
- "unidad": unidad en plural o singular ("unidades", "paquetes", "cajas", "pares", "litros", "kits").
- "estado": "nuevo", "buen estado", "usado" o "a revisar".
- "perecedero": true si tiene vencimiento (alimentos, medicamentos, fórmula, etc.), false si no.
- "vencimiento": SOLO si en la foto se lee claramente una fecha de vencimiento (formato YYYY-MM-DD); si no es legible, omitila o dejala vacía.`;

const SCHEMA = {
  type: "object",
  properties: {
    nombre: { type: "string" },
    categoria: { type: "string", enum: [...CATEGORIES] },
    etiquetas: {
      type: "array",
      items: { type: "string" },
    },
    cantidad_estimada: { type: "integer" },
    unidad: { type: "string" },
    estado: { type: "string", enum: [...ITEM_CONDITIONS] },
    perecedero: { type: "boolean" },
    vencimiento: { type: "string" },
  },
  required: ["nombre", "categoria", "etiquetas", "cantidad_estimada", "unidad", "estado", "perecedero"],
};

export async function tagImageDirect(base64: string, apiKey: string): Promise<GeminiTagResult> {
  const { GoogleGenAI } = await import("@google/genai");
  const client = new GoogleGenAI({ apiKey });
  const interaction = await client.interactions.create({
    model: "gemini-3.5-flash-lite",
    input: [
      { type: "image", mime_type: "image/jpeg", data: base64 },
      { type: "text", text: PROMPT },
    ],
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: SCHEMA,
    },
  });

  const rawText = interaction.output_text ?? "{}";
  const parsed = JSON.parse(rawText) as Record<string, unknown>;
  return normalizeGeminiResult(parsed);
}

export async function tagImage(base64: string): Promise<GeminiTagResult> {
  const { sheetsEndpoint, geminiKey } = getConfig();
  if (sheetsEndpoint) {
    try {
      const mode = getSession()?.token && getSession()?.token !== "local" ? "auth" : "public";
      return await tagImageViaProxy(base64, mode);
    } catch (err) {
      if (err instanceof Error && err.message.includes("GEMINI_API_KEY") && geminiKey) {
        return tagImageDirect(base64, geminiKey);
      }
      throw err;
    }
  }
  if (!geminiKey) {
    throw new Error("NO_API_KEY");
  }
  return tagImageDirect(base64, geminiKey);
}

export function fallbackTags(name: string, category?: Category | ""): string[] {
  return suggestTags(name, category);
}
