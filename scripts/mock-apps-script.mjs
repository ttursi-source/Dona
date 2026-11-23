import http from "node:http";
import { createAppsScriptHarness } from "./appsScriptHarness.mjs";

const PORT = Number(process.env.MOCK_SHEETS_PORT || 8787);
const HOST = "127.0.0.1";
const ORIGIN = `http://${HOST}:${PORT}`;

const harness = createAppsScriptHarness({
  properties: {
    DONA_MOCK_DRIVE_ORIGIN: ORIGIN,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "mock-gemini-key",
  },
});

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const server = http.createServer((req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", ORIGIN);

  // Serve uploaded Drive images cleanly for E2E & lightbox inspection
  const driveMatch = url.pathname.match(/^\/drive\/([^/]+)\.jpg$/);
  if (req.method === "GET" && driveMatch) {
    const file = harness.getDriveFile(driveMatch[1]);
    if (!file) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": file.mimeType || "image/jpeg",
      "Cache-Control": "no-store",
    });
    res.end(file.bytes);
    return;
  }

  if (url.pathname === "/exec" || url.pathname === "/") {
    if (req.method === "GET") {
      const parameter = Object.fromEntries(url.searchParams.entries());
      const result = harness.doGet(parameter);
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(result));
      return;
    }

    if (req.method === "POST") {
      const chunks = [];
      let total = 0;
      req.on("data", (chunk) => {
        total += chunk.length;
        if (total <= 2000000) chunks.push(chunk);
      });
      req.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        const result = harness.doPost(body);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(result));
      });
      return;
    }
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "Ruta no encontrada" }));
});

server.listen(PORT, HOST, () => {
  console.log(`Mock Apps Script doná escuchando en ${ORIGIN}/exec`);
});
