import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const CODE_GS_PATH = path.resolve(import.meta.dirname, "../apps-script/Code.gs");

function makeDefaultGeminiResponse(payload) {
  let text = JSON.stringify({
    nombre: "Paquetes de fideos 500 g",
    categoria: "Alimentos",
    etiquetas: ["fideos", "alimentos", "no perecedero", "seco"],
    cantidad_estimada: 6,
    unidad: "paquetes",
    estado: "nuevo",
    perecedero: true,
    vencimiento: "2027-08-30",
  });

  if (payload && typeof payload === "string" && payload.includes("public")) {
    text = JSON.stringify({
      nombre: "Campera de abrigo talle M",
      categoria: "Ropa y calzado",
      etiquetas: ["campera", "abrigo", "invierno"],
      cantidad_estimada: 1,
      unidad: "unidades",
      estado: "buen estado",
      perecedero: false,
    });
  }

  return {
    getResponseCode: () => 200,
    getContentText: () =>
      JSON.stringify({
        outputs: [{ type: "text", text }],
      }),
  };
}

export function createAppsScriptHarness(options = {}) {
  let timeOffsetMs = 0;
  const now = () => Date.now() + timeOffsetMs;

  const sheets = new Map();
  const folders = new Map();
  const files = new Map();
  const cacheMap = new Map();
  const propsMap = new Map(
    Object.entries({
      GEMINI_API_KEY: "mock-gemini-key",
      DONA_TOKEN_SECRET: "mock-token-secret-for-tests",
      ...(options.properties ?? {}),
    })
  );

  let fileCounter = 0;

  function createSheet(name) {
    const rows = [];
    const sheetApi = {
      getName: () => name,
      getLastRow: () => rows.length,
      getLastColumn: () => (rows.length > 0 ? Math.max(...rows.map((r) => r.length)) : 0),
      appendRow: (arr) => {
        rows.push([...arr]);
      },
      getRange: (startRow, startCol, numRows, numCols) => {
        const r0 = startRow - 1;
        const c0 = startCol - 1;
        return {
          setFontWeight: () => sheetApi,
          getValues: () => {
            const out = [];
            for (let r = 0; r < numRows; r++) {
              const src = rows[r0 + r] ?? [];
              const sliced = [];
              for (let c = 0; c < numCols; c++) {
                sliced.push(src[c0 + c] !== undefined ? src[c0 + c] : "");
              }
              out.push(sliced);
            }
            return out;
          },
          setValues: (matrix) => {
            for (let r = 0; r < numRows; r++) {
              if (!rows[r0 + r]) rows[r0 + r] = [];
              for (let c = 0; c < numCols; c++) {
                rows[r0 + r][c0 + c] = matrix[r][c];
              }
            }
          },
          setValue: (val) => {
            if (!rows[r0]) rows[r0] = [];
            rows[r0][c0] = val;
          },
        };
      },
      _rows: rows,
    };
    return sheetApi;
  }

  const SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
      getSheetByName: (name) => sheets.get(name) ?? null,
      insertSheet: (name) => {
        const s = createSheet(name);
        sheets.set(name, s);
        return s;
      },
    }),
  };

  function makeFolder(name) {
    return {
      getName: () => name,
      createFile: (blob) => {
        fileCounter += 1;
        const id = `mock-file-${fileCounter}`;
        const entry = {
          id,
          name: blob.getName(),
          mimeType: blob.getContentType(),
          bytes: Buffer.from(blob.getBytes()),
          access: null,
          permission: null,
        };
        files.set(id, entry);
        return {
          getId: () => id,
          setSharing: (access, perm) => {
            entry.access = access;
            entry.permission = perm;
          },
        };
      },
    };
  }

  const DriveApp = {
    Access: { ANYONE_WITH_LINK: "ANYONE_WITH_LINK" },
    Permission: { VIEW: "VIEW" },
    getFoldersByName: (name) => {
      const existing = folders.get(name);
      let consumed = false;
      return {
        hasNext: () => Boolean(existing) && !consumed,
        next: () => {
          consumed = true;
          return existing;
        },
      };
    },
    createFolder: (name) => {
      const f = makeFolder(name);
      folders.set(name, f);
      return f;
    },
  };

  const ContentService = {
    MimeType: { JSON: "JSON" },
    createTextOutput: (text) => ({
      _text: text,
      _mime: "TEXT",
      setMimeType: function (m) {
        this._mime = m;
        return this;
      },
      getContent: function () {
        return this._text;
      },
    }),
  };

  const LockService = {
    getScriptLock: () => ({
      waitLock: () => {},
      releaseLock: () => {},
    }),
  };

  const CacheService = {
    getScriptCache: () => ({
      get: (key) => {
        const hit = cacheMap.get(key);
        if (!hit) return null;
        if (hit.exp <= now()) {
          cacheMap.delete(key);
          return null;
        }
        return hit.value;
      },
      put: (key, value, expirationInSeconds = 600) => {
        cacheMap.set(key, {
          value: String(value),
          exp: now() + expirationInSeconds * 1000,
        });
      },
      remove: (key) => {
        cacheMap.delete(key);
      },
    }),
  };

  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (k) => (propsMap.has(k) ? propsMap.get(k) : null),
      setProperty: (k, v) => {
        propsMap.set(k, String(v));
      },
    }),
  };

  const Utilities = {
    DigestAlgorithm: { SHA_256: "SHA_256" },
    base64Decode: (b64) => Buffer.from(b64, "base64"),
    base64DecodeWebSafe: (b64url) => Buffer.from(b64url, "base64url"),
    base64EncodeWebSafe: (bytes) => Buffer.from(bytes).toString("base64url"),
    newBlob: (data, contentType = "application/octet-stream", name = "blob") => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      return {
        getBytes: () => buf,
        getDataAsString: () => buf.toString("utf8"),
        getContentType: () => contentType,
        getName: () => name,
      };
    },
    computeDigest: (_alg, input) => {
      const hash = crypto.createHash("sha256").update(String(input), "utf8").digest();
      // Emulate Google Apps Script signed byte[] (-128..127)
      return Array.from(hash, (b) => (b > 127 ? b - 256 : b));
    },
    getUuid: () => crypto.randomUUID(),
  };

  const fetchSpy = options.urlFetchHandler ?? ((_url, params) => makeDefaultGeminiResponse(params?.payload));

  const UrlFetchApp = {
    fetch: (url, params) => fetchSpy(url, params),
  };

  // Expose Date override inside VM only if time offset is manipulated cleanly
  const FakeDate = class extends Date {
    constructor(...args) {
      if (args.length === 0) {
        super(now());
      } else {
        super(...args);
      }
    }
    static now() {
      return now();
    }
  };

  const sandbox = {
    SpreadsheetApp,
    DriveApp,
    ContentService,
    LockService,
    CacheService,
    PropertiesService,
    Utilities,
    UrlFetchApp,
    Date: FakeDate,
    console,
  };

  const codeSource = fs.readFileSync(CODE_GS_PATH, "utf8");
  const context = vm.createContext(sandbox);
  vm.runInContext(codeSource, context, { filename: CODE_GS_PATH });

  return {
    doGet(parameter = {}) {
      const out = context.doGet({ parameter });
      return JSON.parse(out.getContent());
    },
    doPost(body) {
      const raw = typeof body === "string" ? body : JSON.stringify(body);
      const out = context.doPost({ postData: { contents: raw } });
      return JSON.parse(out.getContent());
    },
    getDriveFile(id) {
      return files.get(id) ?? null;
    },
    getSheetValues(sheetName) {
      const s = sheets.get(sheetName);
      return s ? s._rows.map((r) => [...r]) : [];
    },
    setProperty(k, v) {
      if (v === null || v === undefined) propsMap.delete(k);
      else propsMap.set(k, String(v));
    },
    clearCache() {
      cacheMap.clear();
    },
    advanceTimeMs(ms) {
      timeOffsetMs += ms;
    },
  };
}
