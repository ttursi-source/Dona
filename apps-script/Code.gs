/**
 * doná · Backend compartido en Google Apps Script (Google Sheets + Google Drive + Proxy Gemini).
 *
 * Propiedades del Script (Configuración del proyecto -> Propiedades de la secuencia de comandos):
 * - GEMINI_API_KEY: clave de Google AI Studio (opcional, requerida para etiquetado IA sin exponer la key en el navegador)
 * - DONA_TOKEN_SECRET: secreto HMAC/SHA-256 (si no se define, se genera automáticamente en el primer uso)
 */

var SHEET_ORGS = "Organizaciones";
var SHEET_SEDES = "Sedes";
var SHEET_DONANTES = "Donantes";
var SHEET_INVENTARIO = "Inventario";
var DRIVE_FOLDER_NAME = "doná – fotos inventario";

var MAX_PAYLOAD_BYTES = 1500000;
var TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
var LOCKOUT_THRESHOLD = 5;
var LOCKOUT_SECONDS = 600;
var TAG_LIMIT_AUTH_PER_MIN = 30;
var TAG_LIMIT_PUBLIC_PER_MIN = 20;

var VALID_ID_RE = /^[a-zA-Z0-9_-]{3,64}$/;
var VALID_HASH_RE = /^[a-f0-9]{64}$/;

var ORGS_HEADERS = [
  "id",
  "nombre",
  "tipo",
  "contacto",
  "codeHash",
  "updatedAt",
  "deleted",
  "_srv",
  "_json",
];

var SEDES_HEADERS = [
  "id",
  "orgId",
  "nombre",
  "localidad",
  "responsable",
  "esCentral",
  "activa",
  "lat",
  "lng",
  "codeHash",
  "updatedAt",
  "deleted",
  "_srv",
  "_json",
];

var DONANTES_HEADERS = [
  "id",
  "orgId",
  "nombre",
  "tipo",
  "cuit",
  "contacto",
  "updatedAt",
  "deleted",
  "_srv",
  "_json",
];

var INVENTARIO_HEADERS = [
  "id",
  "fecha",
  "organización",
  "sede",
  "nombre",
  "categoría",
  "etiquetas",
  "cantidad",
  "unidad",
  "estado",
  "perecedero",
  "vencimiento",
  "donante",
  "tipo donante",
  "foto",
  "estado stock",
  "entregado",
  "updatedAt",
  "deleted",
  "_srv",
  "_json",
];

var ALLOWED_CATEGORIES = [
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
];

var ALLOWED_CONDITIONS = ["nuevo", "buen estado", "usado", "a revisar"];

var TAG_PROMPT =
  'Sos un asistente de inventario de una ONG argentina (como Cáritas).\n' +
  'Analizá la foto de esta donación y devolvé los datos estructurados en español rioplatense.\n' +
  'Reglas:\n' +
  '- "nombre": nombre corto y claro del producto o prenda (ej: "Paquetes de fideos 500 g", "Campera de abrigo talle M").\n' +
  '- "categoria": elegí exactamente una de la lista permitida; si no encaja, usá "Otros".\n' +
  '- "etiquetas": entre 3 y 6 tags en minúsculas útiles para buscar.\n' +
  '- "cantidad_estimada": cantidad entera de unidades visibles (mínimo 1).\n' +
  '- "unidad": unidad ("unidades", "paquetes", "cajas", "pares", "litros", "kits").\n' +
  '- "estado": "nuevo", "buen estado", "usado" o "a revisar".\n' +
  '- "perecedero": true si tiene vencimiento, false si no.\n' +
  '- "vencimiento": SOLO si se lee claramente una fecha YYYY-MM-DD; si no, omitila.';

var TAG_SCHEMA = {
  type: "object",
  properties: {
    nombre: { type: "string" },
    categoria: { type: "string", enum: ALLOWED_CATEGORIES },
    etiquetas: { type: "array", items: { type: "string" } },
    cantidad_estimada: { type: "integer" },
    unidad: { type: "string" },
    estado: { type: "string", enum: ALLOWED_CONDITIONS },
    perecedero: { type: "boolean" },
    vencimiento: { type: "string" },
  },
  required: [
    "nombre",
    "categoria",
    "etiquetas",
    "cantidad_estimada",
    "unidad",
    "estado",
    "perecedero",
  ],
};

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function clampStr(val, maxLen) {
  if (val === undefined || val === null) return "";
  var s = String(val).trim();
  if (maxLen && s.length > maxLen) {
    return s.slice(0, maxLen);
  }
  return s;
}

function sanitizeCell(val) {
  if (val === undefined || val === null) return "";
  if (typeof val === "number" || typeof val === "boolean") return val;
  var s = clampStr(val, 4000);
  if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) {
    return "'" + s;
  }
  return s;
}

function isValidId(id) {
  return typeof id === "string" && VALID_ID_RE.test(id);
}

function isValidHash(hash) {
  return typeof hash === "string" && VALID_HASH_RE.test(hash.toLowerCase());
}

function stripSecrets(obj) {
  if (!obj || typeof obj !== "object") return obj;
  var out = {};
  for (var k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && k !== "codeHash") {
      out[k] = obj[k];
    }
  }
  return out;
}

function sha256Hex(text) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text));
  var hex = "";
  for (var i = 0; i < digest.length; i++) {
    var b = (digest[i] + 256) % 256;
    hex += ("0" + b.toString(16)).slice(-2);
  }
  return hex;
}

function getServerSecret() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty("DONA_TOKEN_SECRET");
  if (!secret) {
    secret = sha256Hex(Utilities.getUuid() + ":" + Date.now() + ":" + Math.random());
    props.setProperty("DONA_TOKEN_SECRET", secret);
  }
  return secret;
}

function signToken(payloadObj) {
  var json = JSON.stringify(payloadObj);
  var b64 = Utilities.base64EncodeWebSafe(Utilities.newBlob(json).getBytes());
  var sig = sha256Hex(b64 + "." + getServerSecret());
  return b64 + "." + sig;
}

function verifyToken(token) {
  if (typeof token !== "string" || token.indexOf(".") < 1) return null;
  var parts = token.split(".");
  if (parts.length !== 2) return null;
  var b64 = parts[0];
  var sig = parts[1];
  var expected = sha256Hex(b64 + "." + getServerSecret());
  if (sig !== expected) return null;
  try {
    var bytes = Utilities.base64DecodeWebSafe(b64);
    var json = Utilities.newBlob(bytes).getDataAsString();
    var payload = JSON.parse(json);
    if (!payload || typeof payload.exp !== "number" || payload.exp < Date.now()) {
      return null;
    }
    if (payload.role !== "sede" && payload.role !== "central") return null;
    if (!isValidId(payload.orgId)) return null;
    if (payload.role === "sede" && !isValidId(payload.sedeId)) return null;
    return payload;
  } catch (_err) {
    return null;
  }
}

function getOrCreateSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sheet;
}

function getOrCreateFolder(name) {
  var folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(name);
}

function savePhotoToDrive(id, base64) {
  var cleanBase64 = String(base64).replace(/^data:image\/[^;]+;base64,/, "");
  var decoded = Utilities.base64Decode(cleanBase64);
  var blob = Utilities.newBlob(decoded, "image/jpeg", id + ".jpg");
  var folder = getOrCreateFolder(DRIVE_FOLDER_NAME);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var mockOrigin = PropertiesService.getScriptProperties().getProperty("DONA_MOCK_DRIVE_ORIGIN");
  if (mockOrigin) {
    return mockOrigin.replace(/\/$/, "") + "/drive/" + file.getId() + ".jpg?sz=w400";
  }
  return "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w400";
}

function readRecords(sheet, jsonColIndex, srvColIndex) {
  var lastRow = sheet.getLastRow();
  var width = sheet.getLastColumn();
  if (lastRow < 2 || width < 1) {
    return { rowsById: {}, order: [] };
  }
  var values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  var rowsById = {};
  var order = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var id = String(row[0] || "").trim();
    if (!id) continue;
    var rawJson = row[jsonColIndex];
    var obj = null;
    if (rawJson && typeof rawJson === "string" && rawJson.charAt(0) === "{") {
      try {
        obj = JSON.parse(rawJson);
      } catch (_e) {
        obj = null;
      }
    }
    if (!obj) {
      obj = { id: id };
    }
    var srv = Number(row[srvColIndex]) || 0;
    rowsById[id] = {
      rowIndex: i + 2,
      srv: srv,
      data: obj,
    };
    order.push(id);
  }
  return { rowsById: rowsById, order: order };
}

function upsertRow(sheet, headersLen, entry, rowValues) {
  if (entry && entry.rowIndex > 1) {
    sheet.getRange(entry.rowIndex, 1, 1, headersLen).setValues([rowValues]);
    return entry.rowIndex;
  }
  sheet.appendRow(rowValues);
  return sheet.getLastRow();
}

function buildOrgRow(org, srv) {
  return [
    sanitizeCell(org.id),
    sanitizeCell(clampStr(org.name, 140)),
    sanitizeCell(org.kind === "independiente" ? "independiente" : "red"),
    sanitizeCell(clampStr(org.contact, 200)),
    clampStr(org.codeHash, 64),
    clampStr(org.updatedAt, 40),
    Boolean(org.deleted),
    srv,
    JSON.stringify(org),
  ];
}

function buildSedeRow(sede, srv) {
  return [
    sanitizeCell(sede.id),
    sanitizeCell(sede.orgId),
    sanitizeCell(clampStr(sede.name, 140)),
    sanitizeCell(clampStr(sede.locality, 140)),
    sanitizeCell(clampStr(sede.manager, 140)),
    Boolean(sede.isCentral),
    sede.active !== false,
    typeof sede.lat === "number" ? sede.lat : "",
    typeof sede.lng === "number" ? sede.lng : "",
    clampStr(sede.codeHash, 64),
    clampStr(sede.updatedAt, 40),
    Boolean(sede.deleted),
    srv,
    JSON.stringify(sede),
  ];
}

function buildDonorRow(donor, srv) {
  return [
    sanitizeCell(donor.id),
    sanitizeCell(donor.orgId),
    sanitizeCell(clampStr(donor.name, 160)),
    sanitizeCell(clampStr(donor.kind || "otro", 32)),
    sanitizeCell(clampStr(donor.cuit, 32)),
    sanitizeCell(clampStr(donor.contact, 200)),
    clampStr(donor.updatedAt, 40),
    Boolean(donor.deleted),
    srv,
    JSON.stringify(donor),
  ];
}

function buildInventoryRow(item, srv, names) {
  var storedItem = {};
  for (var k in item) {
    if (Object.prototype.hasOwnProperty.call(item, k)) {
      storedItem[k] = item[k];
    }
  }
  if (storedItem.photoUrl && storedItem.photoThumb) {
    delete storedItem.photoThumb;
  } else if (storedItem.photoThumb && String(storedItem.photoThumb).length > 50000) {
    delete storedItem.photoThumb;
  }

  return [
    sanitizeCell(item.id),
    clampStr(item.createdAt, 40),
    sanitizeCell(names.orgName || item.orgId),
    sanitizeCell(names.sedeName || item.sedeId),
    sanitizeCell(clampStr(item.name, 180)),
    sanitizeCell(clampStr(item.category, 60)),
    sanitizeCell(Array.isArray(item.tags) ? item.tags.join(", ") : ""),
    Math.max(1, Math.round(Number(item.quantity) || 1)),
    sanitizeCell(clampStr(item.unit || "unidades", 40)),
    sanitizeCell(clampStr(item.condition || "buen estado", 32)),
    item.perishable ? "Sí" : "No",
    clampStr(item.expiresAt, 20),
    sanitizeCell(names.donorName || "Particular"),
    sanitizeCell(names.donorKind || "particular"),
    clampStr(item.photoUrl, 300),
    item.status === "entregado" ? "entregado" : "disponible",
    clampStr(item.deliveredAt, 40),
    clampStr(item.updatedAt, 40),
    Boolean(item.deleted),
    srv,
    JSON.stringify(storedItem),
  ];
}

function isNewerOrEqual(incomingUpdatedAt, existingUpdatedAt) {
  if (!existingUpdatedAt) return true;
  return String(incomingUpdatedAt || "") >= String(existingUpdatedAt || "");
}

function checkRateLimit(cacheKey, limitPerMin) {
  var cache = CacheService.getScriptCache();
  var current = Number(cache.get(cacheKey) || "0");
  if (current >= limitPerMin) {
    return false;
  }
  cache.put(cacheKey, String(current + 1), 60);
  return true;
}

function handleLogin(data) {
  var role = data.role;
  var orgId = clampStr(data.orgId, 64);
  var sedeId = clampStr(data.sedeId, 64);
  var codeHash = clampStr(data.codeHash, 64).toLowerCase();

  if ((role !== "sede" && role !== "central") || !isValidId(orgId) || !isValidHash(codeHash)) {
    return { ok: false, error: "Datos de acceso inválidos." };
  }
  if (role === "sede" && !isValidId(sedeId)) {
    return { ok: false, error: "Identificador de sede inválido." };
  }

  var lockScope = role === "central" ? "central:" + orgId : "sede:" + sedeId;
  var lockCacheKey = "login_fail:" + lockScope;
  var cache = CacheService.getScriptCache();
  var failCount = Number(cache.get(lockCacheKey) || "0");
  if (failCount >= LOCKOUT_THRESHOLD) {
    return {
      ok: false,
      locked: true,
      retryAfter: LOCKOUT_SECONDS,
      error: "Demasiados intentos fallidos. Esperá 10 minutos.",
    };
  }

  var orgSheet = getOrCreateSheet(SHEET_ORGS, ORGS_HEADERS);
  var sedeSheet = getOrCreateSheet(SHEET_SEDES, SEDES_HEADERS);
  var orgRecords = readRecords(orgSheet, ORGS_HEADERS.length - 1, ORGS_HEADERS.length - 2);
  var sedeRecords = readRecords(sedeSheet, SEDES_HEADERS.length - 1, SEDES_HEADERS.length - 2);

  var orgEntry = orgRecords.rowsById[orgId];
  if (!orgEntry || orgEntry.data.deleted) {
    return { ok: false, error: "Organización no encontrada en la planilla." };
  }

  var expectedHash = "";
  var tokenSedeId = "";

  if (role === "central") {
    var centralSede = null;
    for (var i = 0; i < sedeRecords.order.length; i++) {
      var se = sedeRecords.rowsById[sedeRecords.order[i]].data;
      if (se.orgId === orgId && se.isCentral && !se.deleted) {
        centralSede = se;
        break;
      }
    }
    expectedHash = String(orgEntry.data.codeHash || (centralSede && centralSede.codeHash) || "").toLowerCase();
    tokenSedeId = centralSede ? centralSede.id : orgId + "-central";
  } else {
    var sedeEntry = sedeRecords.rowsById[sedeId];
    if (!sedeEntry || sedeEntry.data.deleted || sedeEntry.data.orgId !== orgId) {
      return { ok: false, error: "Sede no encontrada en la planilla." };
    }
    if (sedeEntry.data.active === false) {
      return { ok: false, error: "Esta sede fue dada de baja por Sede Central." };
    }
    expectedHash = String(sedeEntry.data.codeHash || "").toLowerCase();
    tokenSedeId = sedeId;
  }

  if (!expectedHash) {
    return { ok: false, error: "La organización o sede aún no tiene código configurado." };
  }

  if (codeHash !== expectedHash) {
    var nextFails = failCount + 1;
    cache.put(lockCacheKey, String(nextFails), LOCKOUT_SECONDS);
    var isLocked = nextFails >= LOCKOUT_THRESHOLD;
    return {
      ok: false,
      locked: isLocked,
      remainingAttempts: Math.max(0, LOCKOUT_THRESHOLD - nextFails),
      retryAfter: isLocked ? LOCKOUT_SECONDS : undefined,
      error: isLocked
        ? "Demasiados intentos fallidos. Esperá 10 minutos."
        : "Código incorrecto.",
    };
  }

  cache.remove(lockCacheKey);
  var now = Date.now();
  var token = signToken({
    role: role,
    orgId: orgId,
    sedeId: tokenSedeId,
    exp: now + TOKEN_TTL_MS,
  });

  return {
    ok: true,
    token: token,
    serverTime: now,
    org: stripSecrets(orgEntry.data),
    sedeId: tokenSedeId,
  };
}

function handleRegisterOrg(data) {
  var org = data.org;
  var central = data.centralSede;
  if (!org || !central) {
    return { ok: false, error: "Faltan datos de la organización o Sede Central." };
  }
  if (org.demo || central.demo) {
    return { ok: false, error: "No se registran organizaciones de demostración en el servidor." };
  }
  if (!isValidId(org.id) || !isValidId(central.id) || central.orgId !== org.id) {
    return { ok: false, error: "Identificadores inválidos." };
  }
  if (!isValidHash(org.codeHash)) {
    return { ok: false, error: "Falta código de acceso válido para Sede Central." };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var now = Date.now();
    var orgSheet = getOrCreateSheet(SHEET_ORGS, ORGS_HEADERS);
    var sedeSheet = getOrCreateSheet(SHEET_SEDES, SEDES_HEADERS);
    var orgRecords = readRecords(orgSheet, ORGS_HEADERS.length - 1, ORGS_HEADERS.length - 2);
    var sedeRecords = readRecords(sedeSheet, SEDES_HEADERS.length - 1, SEDES_HEADERS.length - 2);

    var existing = orgRecords.rowsById[org.id];
    if (existing && !existing.data.deleted) {
      return { ok: false, error: "Ya existe una organización registrada con ese ID." };
    }

    var cleanOrg = {
      id: org.id,
      name: clampStr(org.name, 140),
      kind: org.kind === "independiente" ? "independiente" : "red",
      contact: clampStr(org.contact, 200) || undefined,
      codeHash: String(org.codeHash).toLowerCase(),
      createdAt: clampStr(org.createdAt, 40) || new Date(now).toISOString(),
      updatedAt: clampStr(org.updatedAt, 40) || new Date(now).toISOString(),
      synced: true,
    };

    var cleanCentral = {
      id: central.id,
      orgId: org.id,
      name: clampStr(central.name, 140) || "Sede Central",
      locality: clampStr(central.locality, 140) || "Argentina",
      manager: clampStr(central.manager, 140) || undefined,
      isCentral: true,
      joinedAt: clampStr(central.joinedAt, 40) || new Date(now).toISOString(),
      updatedAt: clampStr(central.updatedAt, 40) || new Date(now).toISOString(),
      codeHash: String(central.codeHash || org.codeHash).toLowerCase(),
      lat: typeof central.lat === "number" ? central.lat : undefined,
      lng: typeof central.lng === "number" ? central.lng : undefined,
      active: true,
      synced: true,
    };

    upsertRow(orgSheet, ORGS_HEADERS.length, existing, buildOrgRow(cleanOrg, now));
    upsertRow(
      sedeSheet,
      SEDES_HEADERS.length,
      sedeRecords.rowsById[cleanCentral.id],
      buildSedeRow(cleanCentral, now)
    );

    var token = signToken({
      role: "central",
      orgId: cleanOrg.id,
      sedeId: cleanCentral.id,
      exp: now + TOKEN_TTL_MS,
    });

    return {
      ok: true,
      token: token,
      serverTime: now,
      org: stripSecrets(cleanOrg),
      sede: stripSecrets(cleanCentral),
    };
  } finally {
    lock.releaseLock();
  }
}

function handleRegisterSede(data) {
  var sede = data.sede;
  if (!sede || !isValidId(sede.id) || !isValidId(sede.orgId)) {
    return { ok: false, error: "Datos de sede inválidos." };
  }
  if (sede.demo) {
    return { ok: false, error: "No se registran sedes demo en la planilla." };
  }
  if (!isValidHash(sede.codeHash)) {
    return { ok: false, error: "Falta código de acceso válido para la sede." };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var now = Date.now();
    var orgSheet = getOrCreateSheet(SHEET_ORGS, ORGS_HEADERS);
    var sedeSheet = getOrCreateSheet(SHEET_SEDES, SEDES_HEADERS);
    var orgRecords = readRecords(orgSheet, ORGS_HEADERS.length - 1, ORGS_HEADERS.length - 2);
    var sedeRecords = readRecords(sedeSheet, SEDES_HEADERS.length - 1, SEDES_HEADERS.length - 2);

    var orgEntry = orgRecords.rowsById[sede.orgId];
    if (!orgEntry || orgEntry.data.deleted) {
      return { ok: false, error: "Organización padre no encontrada." };
    }

    var existing = sedeRecords.rowsById[sede.id];
    if (existing && !existing.data.deleted) {
      return { ok: false, error: "Ya existe una sede con ese identificador." };
    }

    var cleanSede = {
      id: sede.id,
      orgId: sede.orgId,
      name: clampStr(sede.name, 140),
      locality: clampStr(sede.locality, 140),
      manager: clampStr(sede.manager, 140) || undefined,
      isCentral: false,
      joinedAt: clampStr(sede.joinedAt, 40) || new Date(now).toISOString(),
      updatedAt: clampStr(sede.updatedAt, 40) || new Date(now).toISOString(),
      codeHash: String(sede.codeHash).toLowerCase(),
      lat: typeof sede.lat === "number" ? sede.lat : undefined,
      lng: typeof sede.lng === "number" ? sede.lng : undefined,
      active: true,
      synced: true,
    };

    upsertRow(sedeSheet, SEDES_HEADERS.length, existing, buildSedeRow(cleanSede, now));

    var token = signToken({
      role: "sede",
      orgId: cleanSede.orgId,
      sedeId: cleanSede.id,
      exp: now + TOKEN_TTL_MS,
    });

    return {
      ok: true,
      token: token,
      serverTime: now,
      sede: stripSecrets(cleanSede),
    };
  } finally {
    lock.releaseLock();
  }
}

function handleRotateCode(data) {
  var auth = verifyToken(data.token);
  if (!auth || auth.role !== "central") {
    return { ok: false, unauthorized: true, error: "Solo Sede Central puede rotar códigos." };
  }
  var targetType = data.targetType === "central" ? "central" : "sede";
  var targetId = clampStr(data.targetId, 64);
  var newHash = clampStr(data.newCodeHash, 64).toLowerCase();
  if (!isValidId(targetId) || !isValidHash(newHash)) {
    return { ok: false, error: "Parámetros inválidos para rotar código." };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var now = Date.now();
    var nowIso = new Date(now).toISOString();
    var orgSheet = getOrCreateSheet(SHEET_ORGS, ORGS_HEADERS);
    var sedeSheet = getOrCreateSheet(SHEET_SEDES, SEDES_HEADERS);
    var orgRecords = readRecords(orgSheet, ORGS_HEADERS.length - 1, ORGS_HEADERS.length - 2);
    var sedeRecords = readRecords(sedeSheet, SEDES_HEADERS.length - 1, SEDES_HEADERS.length - 2);

    if (targetType === "central") {
      if (targetId !== auth.orgId) {
        return { ok: false, unauthorized: true, error: "Sin permisos sobre otra organización." };
      }
      var orgEntry = orgRecords.rowsById[auth.orgId];
      if (!orgEntry) return { ok: false, error: "Organización no encontrada." };
      orgEntry.data.codeHash = newHash;
      orgEntry.data.updatedAt = nowIso;
      upsertRow(orgSheet, ORGS_HEADERS.length, orgEntry, buildOrgRow(orgEntry.data, now));

      for (var i = 0; i < sedeRecords.order.length; i++) {
        var seEntry = sedeRecords.rowsById[sedeRecords.order[i]];
        if (seEntry.data.orgId === auth.orgId && seEntry.data.isCentral && !seEntry.data.deleted) {
          seEntry.data.codeHash = newHash;
          seEntry.data.updatedAt = nowIso;
          upsertRow(sedeSheet, SEDES_HEADERS.length, seEntry, buildSedeRow(seEntry.data, now));
        }
      }
      return { ok: true, serverTime: now };
    }

    var sedeEntry = sedeRecords.rowsById[targetId];
    if (!sedeEntry || sedeEntry.data.orgId !== auth.orgId || sedeEntry.data.deleted) {
      return { ok: false, error: "Sede no encontrada en esta organización." };
    }
    sedeEntry.data.codeHash = newHash;
    sedeEntry.data.updatedAt = nowIso;
    upsertRow(sedeSheet, SEDES_HEADERS.length, sedeEntry, buildSedeRow(sedeEntry.data, now));
    return { ok: true, serverTime: now };
  } finally {
    lock.releaseLock();
  }
}

function handleSync(data) {
  var auth = verifyToken(data.token);
  if (!auth) {
    return { ok: false, unauthorized: true, error: "Sesión vencida o inválida. Volvé a ingresar." };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var now = Date.now();
    var since = Number(data.since) || 0;

    var orgSheet = getOrCreateSheet(SHEET_ORGS, ORGS_HEADERS);
    var sedeSheet = getOrCreateSheet(SHEET_SEDES, SEDES_HEADERS);
    var donorSheet = getOrCreateSheet(SHEET_DONANTES, DONANTES_HEADERS);
    var invSheet = getOrCreateSheet(SHEET_INVENTARIO, INVENTARIO_HEADERS);

    var orgRecords = readRecords(orgSheet, ORGS_HEADERS.length - 1, ORGS_HEADERS.length - 2);
    var sedeRecords = readRecords(sedeSheet, SEDES_HEADERS.length - 1, SEDES_HEADERS.length - 2);
    var donorRecords = readRecords(donorSheet, DONANTES_HEADERS.length - 1, DONANTES_HEADERS.length - 2);
    var invRecords = readRecords(invSheet, INVENTARIO_HEADERS.length - 1, INVENTARIO_HEADERS.length - 2);

    var authOrg = orgRecords.rowsById[auth.orgId];
    if (!authOrg || authOrg.data.deleted) {
      return { ok: false, unauthorized: true, error: "La organización ya no existe." };
    }
    if (auth.role === "sede") {
      var authSede = sedeRecords.rowsById[auth.sedeId];
      if (!authSede || authSede.data.deleted || authSede.data.active === false) {
        return {
          ok: false,
          unauthorized: true,
          error: "Tu sede fue dada de baja por Sede Central.",
        };
      }
    }

    var syncedIds = { orgs: [], sedes: [], donors: [], items: [] };
    var rejectedIds = { orgs: [], sedes: [], donors: [], items: [] };
    var photoUrls = {};
    var photos = data.photos && typeof data.photos === "object" ? data.photos : {};

    // 1. Orgs (solo Sede Central sobre su propia org)
    var inOrgs = Array.isArray(data.orgs) ? data.orgs : [];
    for (var oi = 0; oi < inOrgs.length; oi++) {
      var o = inOrgs[oi];
      if (!o || o.demo || !isValidId(o.id)) continue;
      if (auth.role !== "central" || o.id !== auth.orgId) {
        rejectedIds.orgs.push(o.id);
        continue;
      }
      var curO = orgRecords.rowsById[o.id];
      if (!curO || isNewerOrEqual(o.updatedAt, curO.data.updatedAt)) {
        var nextOrg = {
          id: o.id,
          name: clampStr(o.name, 140),
          kind: o.kind === "independiente" ? "independiente" : "red",
          contact: clampStr(o.contact, 200) || undefined,
          codeHash: isValidHash(o.codeHash) ? o.codeHash.toLowerCase() : curO ? curO.data.codeHash : undefined,
          createdAt: clampStr(o.createdAt, 40) || (curO && curO.data.createdAt) || new Date(now).toISOString(),
          updatedAt: clampStr(o.updatedAt, 40) || new Date(now).toISOString(),
          deleted: Boolean(o.deleted),
          synced: true,
        };
        var oRowIdx = upsertRow(orgSheet, ORGS_HEADERS.length, curO, buildOrgRow(nextOrg, now));
        orgRecords.rowsById[nextOrg.id] = { rowIndex: oRowIdx, srv: now, data: nextOrg };
        if (!curO) orgRecords.order.push(nextOrg.id);
      }
      syncedIds.orgs.push(o.id);
    }

    // 2. Sedes
    var inSedes = Array.isArray(data.sedes) ? data.sedes : [];
    for (var si = 0; si < inSedes.length; si++) {
      var s = inSedes[si];
      if (!s || s.demo || !isValidId(s.id) || s.orgId !== auth.orgId) {
        if (s && s.id && !s.demo) rejectedIds.sedes.push(s.id);
        continue;
      }
      if (auth.role === "sede" && s.id !== auth.sedeId) {
        rejectedIds.sedes.push(s.id);
        continue;
      }
      var curS = sedeRecords.rowsById[s.id];
      if (!curS || isNewerOrEqual(s.updatedAt, curS.data.updatedAt)) {
        var nextSede = {
          id: s.id,
          orgId: auth.orgId,
          name: clampStr(s.name, 140),
          locality: clampStr(s.locality, 140),
          manager: clampStr(s.manager, 140) || undefined,
          isCentral: curS ? Boolean(curS.data.isCentral) : Boolean(s.isCentral),
          joinedAt: clampStr(s.joinedAt, 40) || (curS && curS.data.joinedAt) || new Date(now).toISOString(),
          updatedAt: clampStr(s.updatedAt, 40) || new Date(now).toISOString(),
          codeHash:
            auth.role === "central" && isValidHash(s.codeHash)
              ? s.codeHash.toLowerCase()
              : curS
              ? curS.data.codeHash
              : isValidHash(s.codeHash)
              ? s.codeHash.toLowerCase()
              : undefined,
          lat: typeof s.lat === "number" ? s.lat : curS ? curS.data.lat : undefined,
          lng: typeof s.lng === "number" ? s.lng : curS ? curS.data.lng : undefined,
          active:
            auth.role === "central"
              ? s.active !== false
              : curS
              ? curS.data.active !== false
              : true,
          deleted: auth.role === "central" ? Boolean(s.deleted) : curS ? Boolean(curS.data.deleted) : false,
          synced: true,
        };
        var sRowIdx = upsertRow(sedeSheet, SEDES_HEADERS.length, curS, buildSedeRow(nextSede, now));
        sedeRecords.rowsById[nextSede.id] = { rowIndex: sRowIdx, srv: now, data: nextSede };
        if (!curS) sedeRecords.order.push(nextSede.id);
      }
      syncedIds.sedes.push(s.id);
    }

    // 3. Donantes
    var inDonors = Array.isArray(data.donors) ? data.donors : [];
    for (var di = 0; di < inDonors.length; di++) {
      var d = inDonors[di];
      if (!d || d.demo || !isValidId(d.id) || d.orgId !== auth.orgId) {
        if (d && d.id && !d.demo) rejectedIds.donors.push(d.id);
        continue;
      }
      var curD = donorRecords.rowsById[d.id];
      if (!curD || isNewerOrEqual(d.updatedAt, curD.data.updatedAt)) {
        var nextDonor = {
          id: d.id,
          orgId: auth.orgId,
          name: clampStr(d.name, 160),
          kind: clampStr(d.kind || "otro", 32),
          cuit: clampStr(d.cuit, 32) || undefined,
          contact: clampStr(d.contact, 200) || undefined,
          createdAt: clampStr(d.createdAt, 40) || (curD && curD.data.createdAt) || new Date(now).toISOString(),
          updatedAt: clampStr(d.updatedAt, 40) || new Date(now).toISOString(),
          deleted: Boolean(d.deleted),
          synced: true,
        };
        var dRowIdx = upsertRow(
          donorSheet,
          DONANTES_HEADERS.length,
          curD,
          buildDonorRow(nextDonor, now)
        );
        donorRecords.rowsById[nextDonor.id] = { rowIndex: dRowIdx, srv: now, data: nextDonor };
        if (!curD) donorRecords.order.push(nextDonor.id);
      }
      syncedIds.donors.push(d.id);
    }

    // 4. Inventario + fotos en Drive
    var inItems = Array.isArray(data.items) ? data.items : [];
    for (var ii = 0; ii < inItems.length; ii++) {
      var it = inItems[ii];
      if (!it || it.demo || !isValidId(it.id) || it.orgId !== auth.orgId) {
        if (it && it.id && !it.demo) rejectedIds.items.push(it.id);
        continue;
      }
      if (auth.role === "sede" && it.sedeId !== auth.sedeId) {
        rejectedIds.items.push(it.id);
        continue;
      }
      var curI = invRecords.rowsById[it.id];
      if (!curI || isNewerOrEqual(it.updatedAt, curI.data.updatedAt)) {
        var photoUrl = clampStr(it.photoUrl, 300) || (curI && curI.data.photoUrl) || undefined;
        if (!photoUrl && !it.deleted && photos[it.id]) {
          photoUrl = savePhotoToDrive(it.id, photos[it.id]);
        }
        if (photoUrl) {
          photoUrls[it.id] = photoUrl;
        }
        var nextItem = {
          id: it.id,
          orgId: auth.orgId,
          sedeId: it.sedeId,
          name: clampStr(it.name, 180),
          category: clampStr(it.category || "Otros", 60),
          tags: Array.isArray(it.tags)
            ? it.tags.slice(0, 10).map(function (t) {
                return clampStr(t, 40).toLowerCase();
              })
            : [],
          quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
          unit: clampStr(it.unit || "unidades", 40),
          condition: clampStr(it.condition || "buen estado", 32),
          perishable: Boolean(it.perishable),
          expiresAt: clampStr(it.expiresAt, 20) || undefined,
          donorId: it.donorId || null,
          photoUrl: photoUrl,
          notes: clampStr(it.notes, 400) || undefined,
          status: it.status === "entregado" ? "entregado" : "disponible",
          createdAt: clampStr(it.createdAt, 40) || (curI && curI.data.createdAt) || new Date(now).toISOString(),
          updatedAt: clampStr(it.updatedAt, 40) || new Date(now).toISOString(),
          deliveredAt: clampStr(it.deliveredAt, 40) || undefined,
          aiSource: it.aiSource === "gemini" ? "gemini" : "manual",
          deleted: Boolean(it.deleted),
          synced: true,
        };

        var sedeEntry = sedeRecords.rowsById[nextItem.sedeId];
        var donorEntry = nextItem.donorId ? donorRecords.rowsById[nextItem.donorId] : null;
        var rowNames = {
          orgName: authOrg.data.name,
          sedeName: sedeEntry ? sedeEntry.data.name : nextItem.sedeId,
          donorName: donorEntry ? donorEntry.data.name : "Particular",
          donorKind: donorEntry ? donorEntry.data.kind : "particular",
        };
        var iRowIdx = upsertRow(
          invSheet,
          INVENTARIO_HEADERS.length,
          curI,
          buildInventoryRow(nextItem, now, rowNames)
        );
        invRecords.rowsById[nextItem.id] = { rowIndex: iRowIdx, srv: now, data: nextItem };
        if (!curI) invRecords.order.push(nextItem.id);
      } else if (curI && curI.data.photoUrl) {
        photoUrls[it.id] = curI.data.photoUrl;
      }
      syncedIds.items.push(it.id);
    }

    // 5. Delta pull (_srv > since) filtrado por orgId y SIN codeHash
    var pullOrgs = [];
    for (var po = 0; po < orgRecords.order.length; po++) {
      var oe = orgRecords.rowsById[orgRecords.order[po]];
      if (oe.data.id === auth.orgId && (since <= 0 || oe.srv > since)) {
        pullOrgs.push(stripSecrets(oe.data));
      }
    }

    var pullSedes = [];
    for (var ps = 0; ps < sedeRecords.order.length; ps++) {
      var se = sedeRecords.rowsById[sedeRecords.order[ps]];
      if (se.data.orgId === auth.orgId && (since <= 0 || se.srv > since)) {
        pullSedes.push(stripSecrets(se.data));
      }
    }

    var pullDonors = [];
    for (var pd = 0; pd < donorRecords.order.length; pd++) {
      var de = donorRecords.rowsById[donorRecords.order[pd]];
      if (de.data.orgId === auth.orgId && (since <= 0 || de.srv > since)) {
        pullDonors.push(de.data);
      }
    }

    var pullItems = [];
    for (var pi = 0; pi < invRecords.order.length; pi++) {
      var ie = invRecords.rowsById[invRecords.order[pi]];
      if (ie.data.orgId === auth.orgId && (since <= 0 || ie.srv > since)) {
        pullItems.push(ie.data);
      }
    }

    return {
      ok: true,
      serverTime: now,
      syncedIds: syncedIds,
      rejectedIds: rejectedIds,
      photoUrls: photoUrls,
      pull: {
        orgs: pullOrgs,
        sedes: pullSedes,
        donors: pullDonors,
        items: pullItems,
      },
    };
  } finally {
    lock.releaseLock();
  }
}

function handleTag(data) {
  var mode = data.mode === "auth" ? "auth" : "public";
  var rlKey = "";
  var limit = TAG_LIMIT_PUBLIC_PER_MIN;

  if (mode === "auth") {
    var auth = verifyToken(data.token);
    if (!auth) {
      return { ok: false, unauthorized: true, error: "Sesión requerida para analizar con IA." };
    }
    rlKey = "rl_tag_auth:" + auth.orgId + ":" + auth.sedeId;
    limit = TAG_LIMIT_AUTH_PER_MIN;
  } else {
    var clientKey = clampStr(data.clientKey || "anon", 64).replace(/[^a-zA-Z0-9_-]/g, "");
    rlKey = "rl_tag_pub:" + (clientKey || "anon");
    limit = TAG_LIMIT_PUBLIC_PER_MIN;
  }

  if (!checkRateLimit(rlKey, limit)) {
    return {
      ok: false,
      rateLimited: true,
      error: "Demasiados análisis en un minuto. Esperá un momento e intentá de nuevo.",
    };
  }

  var apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) {
    return {
      ok: false,
      missingKey: true,
      error: "Falta configurar GEMINI_API_KEY en Propiedades del Script de Apps Script.",
    };
  }

  var cleanBase64 = String(data.photoBase64 || "").replace(/^data:image\/[^;]+;base64,/, "");
  if (!cleanBase64 || cleanBase64.length > 1300000) {
    return { ok: false, error: "Imagen vacía o demasiado pesada." };
  }

  var res = UrlFetchApp.fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-goog-api-key": apiKey,
      "Api-Revision": "2026-05-20",
    },
    payload: JSON.stringify({
      model: "gemini-3.5-flash-lite",
      input: [
        { type: "image", mime_type: "image/jpeg", data: cleanBase64 },
        { type: "text", text: TAG_PROMPT },
      ],
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: TAG_SCHEMA,
      },
    }),
    muteHttpExceptions: true,
  });

  var code = res.getResponseCode();
  var textBody = res.getContentText();
  if (code < 200 || code >= 300) {
    return { ok: false, error: "Gemini devolvió error HTTP " + code + "." };
  }

  var parsedBody = JSON.parse(textBody || "{}");
  var outputs = Array.isArray(parsedBody.outputs) ? parsedBody.outputs : [];
  var rawText = "";
  for (var i = outputs.length - 1; i >= 0; i--) {
    var out = outputs[i];
    if (out && typeof out.text === "string" && out.text.trim()) {
      rawText = out.text.trim();
      break;
    }
  }
  if (!rawText) {
    return { ok: false, error: "Gemini no devolvió texto estructurado." };
  }

  rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  var result = JSON.parse(rawText);
  return { ok: true, result: result };
}

function handleGetRequest(action) {
  if (action === "ping") {
    return {
      ok: true,
      version: 2,
      serverTime: Date.now(),
      hasGeminiKey: Boolean(PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY")),
    };
  }

  if (action === "publicSedes") {
    var orgSheet = getOrCreateSheet(SHEET_ORGS, ORGS_HEADERS);
    var sedeSheet = getOrCreateSheet(SHEET_SEDES, SEDES_HEADERS);
    var orgRecords = readRecords(orgSheet, ORGS_HEADERS.length - 1, ORGS_HEADERS.length - 2);
    var sedeRecords = readRecords(sedeSheet, SEDES_HEADERS.length - 1, SEDES_HEADERS.length - 2);

    var orgs = [];
    for (var oi = 0; oi < orgRecords.order.length; oi++) {
      var o = orgRecords.rowsById[orgRecords.order[oi]].data;
      if (!o.deleted && !o.demo) {
        orgs.push(stripSecrets(o));
      }
    }

    var sedes = [];
    for (var si = 0; si < sedeRecords.order.length; si++) {
      var s = sedeRecords.rowsById[sedeRecords.order[si]].data;
      if (!s.deleted && !s.demo && s.active !== false) {
        sedes.push(stripSecrets(s));
      }
    }

    return {
      ok: true,
      serverTime: Date.now(),
      orgs: orgs,
      sedes: sedes,
    };
  }

  return { ok: false, error: "Acción GET no soportada: " + action };
}

function dispatchPost(rawBody) {
  if (!rawBody || String(rawBody).length > MAX_PAYLOAD_BYTES) {
    return { ok: false, error: "Payload vacío o mayor al límite permitido (1.5 MB)." };
  }
  var data = JSON.parse(rawBody);
  var action = clampStr(data.action, 40);

  if (action === "registerOrg") return handleRegisterOrg(data);
  if (action === "registerSede") return handleRegisterSede(data);
  if (action === "login") return handleLogin(data);
  if (action === "rotateCode") return handleRotateCode(data);
  if (action === "sync") return handleSync(data);
  if (action === "tag") return handleTag(data);

  return { ok: false, error: "Acción no soportada: " + action };
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || "{}";
    return jsonOut(dispatchPost(raw));
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || "ping";
    return jsonOut(handleGetRequest(action));
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}
