import fs from "node:fs";
import path from "node:path";

const LIST_URL = "https://quieroayudar.org/organizaciones/en/caba";
const OUT_PATH = path.resolve(import.meta.dirname, "../public/data/caba-ongs.json");
const CONCURRENCY = 8;

const COMUNA_CENTROIDS = {
  1: [-34.6065, -58.3745],
  2: [-34.5889, -58.3935],
  3: [-34.6148, -58.4027],
  4: [-34.6426, -58.3878],
  5: [-34.6186, -58.4203],
  6: [-34.6188, -58.4426],
  7: [-34.6335, -58.4586],
  8: [-34.6716, -58.4638],
  9: [-34.6498, -58.5008],
  10: [-34.6302, -58.5042],
  11: [-34.6056, -58.4871],
  12: [-34.5683, -58.4882],
  13: [-34.5613, -58.4566],
  14: [-34.5805, -58.4205],
  15: [-34.5919, -58.4547],
};

// Base curada preexistente del mapa CABA para enriquecer o sumar sedes estratégicas no duplicadas
const CURATED_POINTS = [
  { name: "Fundación Sí (Sede Central)", zone: "Palermo Hollywood", address: "Ángel Justiniano Carranza 1962, CABA", phone: "+54 11 4775-6690", email: "info@fundacionsi.org.ar", items: "Ropa de abrigo, calzado, frazadas, útiles", lat: -34.5815, lng: -58.4396, categories: ["Ropa", "Útiles"], description: "Recepción central de donaciones y coordinación de recorridas nocturnas y proyectos educativos." },
  { name: "Cáritas Argentina (Comisión Nacional)", zone: "San Nicolás", address: "Balcarce 236, CABA", phone: "+54 11 4342-8650", email: "comunicaciones@caritas.org.ar", items: "Ropa, calzado, alimentos no perecederos", lat: -34.6105, lng: -58.3708, categories: ["Ropa", "Alimentos"], description: "Comisión Nacional de Cáritas Argentina para articulación de campañas solidarias." },
  { name: "Cáritas Buenos Aires (Sede Arquidiocesana)", zone: "Flores", address: "Bogotá 2461, CABA", phone: "+54 11 4611-2999", email: "info@caritasbsas.org.ar", items: "Ropa, frazadas, colchones, alimentos", lat: -34.6275, lng: -58.4658, categories: ["Ropa", "Alimentos", "Muebles"], description: "Sede arquidiocesana de Cáritas Buenos Aires en CABA." },
  { name: "Ejército de Salvación (Sede Central)", zone: "Parque Patricios / Pompeya", address: "Av. Sáenz 580, CABA", phone: "+54 11 4911-7561", email: "donaciones@ejercitodesalvacion.org.ar", items: "Muebles, ropa, calzado, electrodomésticos", lat: -34.6462, lng: -58.4165, categories: ["Muebles", "Ropa"], description: "Centro receptor de muebles, indumentaria, calzado y artículos del hogar." },
  { name: "Ejército de Salvación (Hogar El Refugio)", zone: "La Boca / Barracas", address: "Av. Pedro de Mendoza 3015, CABA", phone: "+54 11 4301-1503", email: "donaciones@ejercitodesalvacion.org.ar", items: "Ropa de hombre/mujer, calzado, abrigo", lat: -34.6428, lng: -58.3662, categories: ["Ropa"], description: "Hogar y punto de recepción en zona sur de CABA." },
  { name: "Fundación Tzedaká", zone: "Almagro / Villa Crespo", address: "Estado de Israel 4156, CABA", phone: "+54 11 4863-5900", email: "info@tzedaka.org.ar", items: "Medicamentos, ropa en buen estado, libros, muebles", lat: -34.5996, lng: -58.4258, categories: ["Salud", "Ropa", "Útiles", "Muebles"], description: "Banco Comunitario de Medicamentos y programas de asistencia social integral." },
  { name: "Fundación Equidad (Reacondicionamiento IT)", zone: "Monserrat", address: "Av. Belgrano 909, CABA", phone: "+54 11 5272-0540", email: "info@equidad.org", items: "Computadoras, notebooks, monitores, celulares", lat: -34.6129, lng: -58.3792, categories: ["Tecnología"], description: "Taller de reacondicionamiento tecnológico para escuelas y organizaciones sociales." },
  { name: "Fundación Garrahan (Casa Garrahan)", zone: "Constitución", address: "Pichincha 1734, CABA", phone: "+54 11 4941-1276", email: "info@fundaciongarrahan.org.ar", items: "Tapitas, papel, ropa infantil, juguetes sanos", lat: -34.6295, lng: -58.3976, categories: ["Bebés", "Útiles", "Ropa", "Otros"], description: "Acompañamiento a pacientes pediátricos del interior y programa de reciclado solidario." },
  { name: "Fundación Margarita Barrientos (Los Piletones)", zone: "Villa Soldati", address: "Plumerillo 3995, CABA", phone: "+54 11 4919-1333", email: "info@margaritabarrientos.org.ar", items: "Alimentos, ropa, calzado, útiles escolares", lat: -34.6648, lng: -58.4445, categories: ["Alimentos", "Ropa", "Útiles"], description: "Comedor comunitario y centro asistencial en Villa Soldati." },
  { name: "TECHO Argentina (Sede Buenos Aires)", zone: "Monserrat", address: "Av. Paseo Colón 532, CABA", phone: "+54 11 5530-5600", email: "info.argentina@techo.org", items: "Herramientas, mobiliario, equipamiento comunitario", lat: -34.6148, lng: -58.3688, categories: ["Muebles", "Otros"], description: "Trabajo conjunto en barrios populares para vivienda de emergencia e infraestructura." },
  { name: "CONIN Barracas (Nutrición Infantil)", zone: "Barracas", address: "Olavarría 2108, CABA", phone: "+54 11 4301-2345", email: "info@coninbarracas.org.ar", items: "Leche en polvo, alimentos, ropa de bebé y niños", lat: -34.6425, lng: -58.3782, categories: ["Alimentos", "Bebés", "Ropa"], description: "Centro de prevención de la desnutrición infantil y acompañamiento familiar." },
  { name: "Fundación Natalí Dafne Flexer", zone: "Palermo / Almagro", address: "Mansilla 3125, CABA", phone: "+54 11 4825-5333", email: "info@fundacionflexer.org", items: "Ropa infantil, juguetes nuevos, libros de cuentos", lat: -34.5946, lng: -58.4105, categories: ["Ropa", "Útiles", "Bebés"], description: "Ayuda integral a niños y jóvenes con cáncer y sus familias." },
  { name: "Haciendo Camino (Sede CABA)", zone: "Retiro", address: "Juncal 840, CABA", phone: "+54 11 4393-0555", email: "info@haciendocamino.org.ar", items: "Ropa de niños, calzado, leche maternizada, cochecitos", lat: -34.5934, lng: -58.3792, categories: ["Bebés", "Ropa", "Alimentos"], description: "Atención materno-infantil y nutrición en comunidades vulnerables." },
  { name: "Asociación Conciencia (Sede Central)", zone: "San Telmo", address: "Perú 845, CABA", phone: "+54 11 4393-3719", email: "conciencia@conciencia.org", items: "Útiles escolares, libros, notebooks educativas", lat: -34.6178, lng: -58.3742, categories: ["Útiles", "Tecnología"], description: "Programas educativos, becas escolares y participación ciudadana." },
  { name: "ALPI Asociación Civil", zone: "Palermo", address: "Soler 3945, CABA", phone: "+54 11 4821-1200", email: "info@alpi.org.ar", items: "Elementos ortopédicos, sillas de ruedas, insumos", lat: -34.5912, lng: -58.4195, categories: ["Salud"], description: "Rehabilitación neuromotora y banco de elementos ortopédicos." },
  { name: "COAS (Cooperadora de Acción Social)", zone: "Recoleta", address: "Ayacucho 1053, CABA", phone: "+54 11 4813-8532", email: "coas@coas.org.ar", items: "Ropa, muebles, vajilla, libros, electrodomésticos", lat: -34.5955, lng: -58.3952, categories: ["Muebles", "Ropa", "Útiles"], description: "Equipamiento hospitalario e iniciativas solidarias en hospitales públicos porteños." },
  { name: "Red Solidaria (Punto Plaza de Mayo)", zone: "Microcentro", address: "Av. Rivadavia 437, CABA", phone: "+54 11 4796-5828", email: "hola@redsolidaria.org.ar", items: "Abrigo de invierno, frazadas, calzado, alimentos", lat: -34.6076, lng: -58.3732, categories: ["Ropa", "Alimentos"], description: "Articulación de campañas de frío, alimentos y emergencias." },
  { name: "Fundación Vivienda Digna (CABA)", zone: "San Nicolás", address: "Esmeralda 629, CABA", phone: "+54 11 5368-7300", email: "info@viviendadigna.org.ar", items: "Muebles, electrodomésticos, materiales de construcción", lat: -34.6004, lng: -58.3782, categories: ["Muebles"], description: "Recepción y redistribución social de mobiliario y equipamiento para el hogar." },
  { name: "Proyecto 4 Patas / Donaciones CABA", zone: "Caballito", address: "Av. Rivadavia 5126, CABA", phone: "+54 11 4901-8800", email: "info@proyecto4patas.org", items: "Mantas, sábanas, colchones usados, alimento", lat: -34.6184, lng: -58.4382, categories: ["Ropa", "Alimentos", "Otros"], description: "Rescate y cuidado animal con recepción de mantas y alimento balanceado." },
  { name: "Cáritas Parroquia Inmaculada Concepción", zone: "Belgrano", address: "Vuelta de Obligado 2042, CABA", phone: "+54 11 4783-8008", email: "secretaria@inmaculadabelgrano.org.ar", items: "Ropa de estación, calzado, alimentos no perecederos", lat: -34.5618, lng: -58.4556, categories: ["Ropa", "Alimentos"], description: "Parroquia receptora de ropa de estación y alimentos en Belgrano." },
  { name: "Santuario San Cayetano (Centro Recepción)", zone: "Liniers", address: "Cuzco 150, CABA", phone: "+54 11 4641-0054", email: "santuario@sancayetano.org.ar", items: "Alimentos no perecederos, ropa, calzado, útiles", lat: -34.6398, lng: -58.5262, categories: ["Alimentos", "Ropa", "Útiles"], description: "Asistencia comunitaria permanente y entregas solidarias en Liniers." },
  { name: "Parroquia Ntra. Sra. de Caacupé (Cáritas)", zone: "Caballito", address: "Av. Rivadavia 4879, CABA", phone: "+54 11 4901-1811", email: "secretaria@parroquiacaacupe.org.ar", items: "Ropa, calzado, abrigo, alimentos, frazadas", lat: -34.6172, lng: -58.4342, categories: ["Ropa", "Alimentos"], description: "Punto Cáritas parroquial en Caballito." },
  { name: "Parroquia San Patricio (Cáritas Urquiza)", zone: "Villa Urquiza", address: "Echeverría 3910, CABA", phone: "+54 11 4552-1351", email: "parroquiasanpatricio@gmail.com", items: "Ropa, calzado, muebles pequeños, alimentos", lat: -34.5738, lng: -58.4715, categories: ["Ropa", "Alimentos", "Muebles"], description: "Recepción parroquial en Villa Urquiza." },
  { name: "Parroquia San Antonio de Padua (Cáritas)", zone: "Villa Devoto", address: "Av. Lincoln 3751, CABA", phone: "+54 11 4501-4895", email: "secretaria@sanantoniodevoto.com.ar", items: "Ropa en buen estado, calzado, alimentos", lat: -34.5992, lng: -58.5112, categories: ["Ropa", "Alimentos"], description: "Recepción comunitaria en Villa Devoto." },
  { name: "Fundación Huésped (Sede CABA)", zone: "Almagro / Boedo", address: "Pasaje Ángel Peluffo 3932, CABA", phone: "+54 11 4981-7777", email: "info@huesped.org.ar", items: "Insumos comunitarios, equipamiento informático", lat: -34.6142, lng: -58.4216, categories: ["Tecnología", "Salud"], description: "Salud pública, prevención y acompañamiento social." },
  { name: "Hogar de Cristo / Parroquia Caacupé", zone: "Barracas", address: "Av. Osvaldo Cruz 3470, CABA", phone: "+54 11 4302-9514", email: "info@hogardecristo.org.ar", items: "Ropa, calzado, colchones, alimentos, abrigo", lat: -34.6512, lng: -58.3965, categories: ["Ropa", "Alimentos", "Muebles"], description: "Centro barrial en Villa 21-24 / Barracas." },
  { name: "Cooperativa El Álamo (Reciclaje IT)", zone: "Villa Pueyrredón", address: "Av. Nazca 5099, CABA", phone: "+54 11 4572-9104", email: "cooperativaelalamo@gmail.com", items: "Electrónicos, pequeños electrodomésticos, libros", lat: -34.5852, lng: -58.4988, categories: ["Tecnología", "Muebles", "Útiles"], description: "Cooperativa de recuperadores urbanos y reciclado." },
  { name: "Fundación Cimientos", zone: "Retiro / Recoleta", address: "Paraná 1160, CABA", phone: "+54 11 4829-8600", email: "info@cimientos.org", items: "Notebooks, tablets, celulares y útiles para becas", lat: -34.5968, lng: -58.3886, categories: ["Tecnología", "Útiles"], description: "Becas y acompañamiento para terminalidad educativa." },
  { name: "Centro Comunitario San Juan Bautista", zone: "Mataderos", address: "Av. Alberdi 6150, CABA", phone: "+54 11 4687-2415", email: "info@caritasbsas.org.ar", items: "Muebles, colchones, frazadas, ropa de abrigo", lat: -34.6518, lng: -58.4962, categories: ["Muebles", "Ropa"], description: "Asistencia social en Mataderos." },
];

const ENTITY_MAP = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  ntilde: "ñ",
  Ntilde: "Ñ",
  uuml: "ü",
  Uuml: "Ü",
  iquest: "¿",
  iexcl: "¡",
};

function decodeHtml(str) {
  return String(str || "")
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => ENTITY_MAP[name] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

function normText(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCategories(rawList) {
  const joined = normText(rawList.join(" "));
  const found = new Set();

  if (/\b(indumentaria|ropa|calzado|abrigo|frazada|frazadas|colchon|colchones|textil|sabana|sabanas|manta|mantas|lana|vestimenta)\b/.test(joined)) {
    found.add("Ropa");
  }
  if (/\b(alimento|alimentos|comida|perecedero|perecederos|leche|mercaderia|desayuno|merienda)\b/.test(joined)) {
    found.add("Alimentos");
  }
  if (/\b(mueble|muebles|cocina|electrodomestico|electrodomesticos|hogar|construccion|herramienta|herramientas|vajilla|bazar|silla|mesa|cama|placard|equipamiento)\b/.test(joined)) {
    found.add("Muebles");
  }
  if (/\b(salud|medicamento|medicamentos|remedio|remedios|higiene|limpieza|ortoped|panal adulto|botiquin|panales adultos)\b/.test(joined)) {
    found.add("Salud");
  }
  if (/\b(tecnologia|comput|electron|informat|notebook|celular|monitor|tablet|impresora|telefonia)\b/.test(joined)) {
    found.add("Tecnología");
  }
  if (/\b(util|utiles|libro|libros|escolar|escolares|educac|juguete|juguetes|deporte|recreac|cuento|cuaderno|mochila)\b/.test(joined)) {
    found.add("Útiles");
  }
  if (/\b(bebe|bebes|panal|panales|materniz|cochecito|cuna|infantil|mamadera|primera infancia)\b/.test(joined)) {
    found.add("Bebés");
  }

  if (found.size === 0) {
    found.add("Otros");
  }
  return Array.from(found);
}

function isInCabaBounds(lat, lng) {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -34.72 &&
    lat <= -34.51 &&
    lng >= -58.55 &&
    lng <= -58.32
  );
}

function isCabaAddress(addr) {
  if (!addr) return false;
  const reg = String(addr.addressRegion || "");
  const loc = String(addr.addressLocality || "");
  return /CABA|Capital Federal|Ciudad Aut/i.test(reg) || /Comuna \d+/i.test(loc);
}

function comunaFallbackCoords(zoneText, indexSalt) {
  const m = String(zoneText || "").match(/Comuna\s+(\d{1,2})/i);
  const comuna = m ? Number(m[1]) : 0;
  const base = COMUNA_CENTROIDS[comuna] ?? [-34.6118, -58.437];
  // Pequeño desplazamiento determinístico (~120m) para evitar apilamiento idéntico
  const angle = (indexSalt * 137.5 * Math.PI) / 180;
  const r = 0.0012;
  return [
    Number((base[0] + Math.sin(angle) * r).toFixed(5)),
    Number((base[1] + Math.cos(angle) * r).toFixed(5)),
  ];
}

function extractMaterialNeeds(html) {
  const startIdx = html.indexOf("Necesidades materiales");
  if (startIdx < 0) return { groups: [], items: [] };

  let endIdx = html.length;
  for (const marker of [">Voluntariado<", "Voluntariado</p>", "sedes activas", "Dónde estamos"]) {
    const pos = html.indexOf(marker, startIdx + 20);
    if (pos > startIdx && pos < endIdx) {
      endIdx = pos;
    }
  }
  const block = html.slice(startIdx, Math.min(endIdx, startIdx + 12000));
  const groups = [];
  const items = [];

  const groupMatches = block.matchAll(
    /<p class="text-sm font-semibold text-foreground">([^<]+)<\/p>/g
  );
  for (const gm of groupMatches) {
    const label = decodeHtml(gm[1]);
    if (label && !groups.includes(label)) groups.push(label);
  }

  const subMatches = block.matchAll(/<\/svg>([^<]+)<\/span><\/li>/g);
  for (const sm of subMatches) {
    const sub = decodeHtml(sm[1]);
    if (sub && !items.includes(sub)) items.push(sub);
  }

  return { groups, items };
}

async function fetchWithRetry(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          "User-Agent": "dona-caba-mapper/1.0 (https://github.com)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (!res.ok) {
        if (attempt < retries && (res.status >= 500 || res.status === 429)) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
        throw new Error(`HTTP ${res.status} en ${url}`);
      }
      return await res.text();
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`No se pudo descargar ${url}`);
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pickWebsite(sameAs) {
  if (!Array.isArray(sameAs)) return "";
  const nonSocial = sameAs.find(
    (u) => typeof u === "string" && !/facebook\.com|instagram\.com|twitter\.com|x\.com/i.test(u)
  );
  return nonSocial || (typeof sameAs[0] === "string" ? sameAs[0] : "");
}

async function main() {
  console.log("Descargando listado CABA desde Quiero Ayudar...");
  const listHtml = await fetchWithRetry(LIST_URL);

  const slugMatches = [
    ...listHtml.matchAll(/href="\/organizaciones\/([a-z0-9-]+)"/g),
  ].map((m) => m[1]);
  const reserved = new Set(["en", "donar", "voluntariado", "mapa"]);
  const slugs = Array.from(new Set(slugMatches.filter((s) => !reserved.has(s))));
  console.log(`Encontrados ${slugs.length} slugs únicos en CABA.`);

  const parsedOrgs = [];
  let cursor = 0;
  let failed = 0;

  async function worker(workerIndex) {
    while (cursor < slugs.length) {
      const idx = cursor++;
      const slug = slugs[idx];
      const url = `https://quieroayudar.org/organizaciones/${slug}`;
      try {
        const html = await fetchWithRetry(url);

        const ldMatches = [
          ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
        ];
        let ngo = null;
        for (const lm of ldMatches) {
          try {
            const parsed = JSON.parse(lm[1]);
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            const found = arr.find(
              (item) =>
                item &&
                item["@type"] === "NGO" &&
                item["@id"] !== "https://quieroayudar.org/#organization"
            );
            if (found) {
              ngo = found;
              break;
            }
          } catch {
            // ignore bad block
          }
        }
        if (!ngo || !ngo.name) continue;

        const { groups, items } = extractMaterialNeeds(html);
        const recibeMatch = html.match(/Recibe\s+(\d+)\s+tipo/i);
        const receivesGoods =
          groups.length > 0 || items.length > 0 || (recibeMatch && Number(recibeMatch[1]) > 0);
        if (!receivesGoods) continue;

        const locations = Array.isArray(ngo.location) ? ngo.location : [];
        const cabaLocs = locations.filter(
          (loc) =>
            isCabaAddress(loc?.address) ||
            isInCabaBounds(loc?.geo?.latitude, loc?.geo?.longitude)
        );

        const primaryLoc = cabaLocs[0] || locations[0] || null;
        const primaryAddrObj = primaryLoc?.address || ngo.address || {};
        const zoneRaw = decodeHtml(primaryAddrObj.addressLocality || "CABA");
        const streetRaw = decodeHtml(primaryAddrObj.streetAddress || "");
        const addressFull = streetRaw
          ? `${streetRaw}, ${zoneRaw ? zoneRaw + ", " : ""}CABA`
          : `${zoneRaw || "Ciudad Autónoma de Buenos Aires"}, CABA`;

        let lat = primaryLoc?.geo?.latitude;
        let lng = primaryLoc?.geo?.longitude;
        let approx = false;
        if (!isInCabaBounds(lat, lng)) {
          [lat, lng] = comunaFallbackCoords(zoneRaw, idx + workerIndex);
          approx = true;
        }

        const extraSedes = cabaLocs
          .slice(1)
          .filter((loc) => isInCabaBounds(loc?.geo?.latitude, loc?.geo?.longitude))
          .map((loc) => ({
            address: decodeHtml(loc?.address?.streetAddress || "Sede en CABA"),
            zone: decodeHtml(loc?.address?.addressLocality || "CABA"),
            hours: loc?.openingHours ? decodeHtml(loc.openingHours) : undefined,
            lat: loc.geo.latitude,
            lng: loc.geo.longitude,
          }));

        const rawTerms = [...groups, ...items];
        const categories = normalizeCategories(rawTerms);
        const itemsSummary =
          items.length > 0
            ? items.join(", ")
            : groups.length > 0
            ? groups.join(", ")
            : "Donaciones materiales";

        const mailMatch = [...html.matchAll(/href="mailto:([^"?#]+)"/gi)]
          .map((m) => decodeHtml(m[1]))
          .find((m) => m && !/quieroayudar\.org/i.test(m));
        const telMatch = html.match(/href="tel:([^"]+)"/i);
        const waMatch = html.match(/href="(https?:\/\/(?:wa\.me|api\.whatsapp\.com)\/[^"]+)"/i);

        const ownUrl =
          typeof ngo.url === "string" && !ngo.url.includes("quieroayudar.org")
            ? ngo.url
            : "";

        parsedOrgs.push({
          slug,
          name: decodeHtml(ngo.name),
          zone: zoneRaw || "CABA",
          address: addressFull,
          phone: decodeHtml(ngo.telephone || (telMatch ? telMatch[1] : "")),
          email: decodeHtml(ngo.email || mailMatch || ""),
          website: ownUrl || pickWebsite(ngo.sameAs),
          whatsapp: waMatch ? waMatch[1] : "",
          hours: primaryLoc?.openingHours ? decodeHtml(primaryLoc.openingHours) : "",
          items: itemsSummary,
          rawCategories: groups,
          categories,
          category: categories[0],
          description: decodeHtml(ngo.description || "").slice(0, 320),
          lat: Number(lat),
          lng: Number(lng),
          approx,
          extraSedes: extraSedes.length > 0 ? extraSedes : undefined,
          sourceUrl: `https://quieroayudar.org/organizaciones/${slug}`,
        });
      } catch (err) {
        failed += 1;
        console.warn(`Error en ${slug}: ${err.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));

  console.log(
    `Procesadas ${slugs.length} páginas (${failed} errores). Reciben donaciones materiales en CABA: ${parsedOrgs.length}`
  );

  // Fusionar sedes curadas preexistentes evitando duplicados
  for (const curated of CURATED_POINTS) {
    const curNorm = normText(curated.name.replace(/\([^)]*\)/g, ""));
    const curTokens = curNorm.split(" ").filter((w) => w.length >= 3);

    const existing = parsedOrgs.find((o) => {
      const oNorm = normText(o.name.replace(/\([^)]*\)/g, ""));
      if (oNorm === curNorm || oNorm.includes(curNorm) || curNorm.includes(oNorm)) {
        return true;
      }
      const dist = distanceMeters(o.lat, o.lng, curated.lat, curated.lng);
      const sharedTokens = curTokens.filter((t) => oNorm.includes(t));
      return dist < 350 && sharedTokens.length >= 2;
    });

    if (existing) {
      if (!existing.phone && curated.phone) existing.phone = curated.phone;
      if (!existing.email && curated.email) existing.email = curated.email;
      for (const c of curated.categories) {
        if (!existing.categories.includes(c)) existing.categories.push(c);
      }
      existing.category = existing.categories[0];
    } else {
      parsedOrgs.push({
        slug: normText(curated.name).replace(/\s+/g, "-"),
        name: curated.name,
        zone: curated.zone,
        address: curated.address,
        phone: curated.phone,
        email: curated.email,
        website: "",
        hours: "",
        items: curated.items,
        rawCategories: curated.categories,
        categories: [...curated.categories],
        category: curated.categories[0],
        description: curated.description,
        lat: curated.lat,
        lng: curated.lng,
        approx: false,
        sourceUrl: "",
      });
    }
  }

  parsedOrgs.sort((a, b) => a.name.localeCompare(b.name, "es"));

  const finalItems = parsedOrgs.map((org, idx) => ({
    id: idx + 1,
    ...org,
  }));

  const exactGeoCount = finalItems.filter((o) => !o.approx).length;
  const approxGeoCount = finalItems.filter((o) => o.approx).length;
  const catCounts = {};
  for (const item of finalItems) {
    for (const c of item.categories) {
      catCounts[c] = (catCounts[c] || 0) + 1;
    }
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "Quiero Ayudar (quieroayudar.org) + relevamiento CABA",
        total: finalItems.length,
        items: finalItems,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Guardado dataset en ${OUT_PATH}`);
  console.log(`Total organizaciones: ${finalItems.length}`);
  console.log(`Coordenadas exactas: ${exactGeoCount} | Centroide comuna: ${approxGeoCount}`);
  console.log("Distribución por categoría:", catCounts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
