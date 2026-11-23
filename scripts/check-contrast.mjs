import fs from "node:fs";
import path from "node:path";

function parseHex(hex) {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]) {
  const linear = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(fgHex, bgHex) {
  const l1 = relativeLuminance(parseHex(fgHex));
  const l2 = relativeLuminance(parseHex(bgHex));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function extractCssVar(block, name) {
  const match = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,6})`));
  return match ? match[1] : null;
}

const gdSource = fs.readFileSync(
  path.resolve(import.meta.dirname, "../src/components/ui/glassy-dashboard.tsx"),
  "utf8"
);
const lightMatch = gdSource.match(/\.gd-app\s*\{([\s\S]*?)\}/);
const darkMatch = gdSource.match(/\.gd-app\[data-theme="dark"\]\s*\{([\s\S]*?)\}/);

const pairs = [
  // Dark app palette
  { label: "#f8fafc on #090d16 (main heading/text)", fg: "#f8fafc", bg: "#090d16", min: 4.5 },
  { label: "#f8fafc on #111827 (card heading/text)", fg: "#f8fafc", bg: "#111827", min: 4.5 },
  { label: "#cbd5e1 on #090d16 (body copy)", fg: "#cbd5e1", bg: "#090d16", min: 4.5 },
  { label: "#cbd5e1 on #111827 (card body copy)", fg: "#cbd5e1", bg: "#111827", min: 4.5 },
  { label: "#94a3b8 on #090d16 (secondary copy)", fg: "#94a3b8", bg: "#090d16", min: 4.5 },
  { label: "#94a3b8 on #111827 (card secondary copy)", fg: "#94a3b8", bg: "#111827", min: 4.5 },
  { label: "#38bdf8 on #090d16 (accent text)", fg: "#38bdf8", bg: "#090d16", min: 4.5 },
  { label: "#38bdf8 on #111827 (card accent text)", fg: "#38bdf8", bg: "#111827", min: 4.5 },
  { label: "#090d16 on #38bdf8 (primary CTA text)", fg: "#090d16", bg: "#38bdf8", min: 4.5 },
  { label: "#7dd3fc on #0f172a (demo banner accent)", fg: "#7dd3fc", bg: "#0f172a", min: 4.5 },
];

if (lightMatch) {
  const b = lightMatch[1];
  const surface = extractCssVar(b, "--gd-surface") || "#f6ece2";
  const ink = extractCssVar(b, "--gd-ink") || "#25201e";
  const muted = extractCssVar(b, "--gd-muted") || "#423731";
  const teal = extractCssVar(b, "--gd-teal") || "#09644f";
  const coral = extractCssVar(b, "--gd-coral") || "#a43c27";
  const primary = extractCssVar(b, "--gd-primary") || "#261e1b";
  const primaryInk = extractCssVar(b, "--gd-primary-ink") || "#fffaf5";
  pairs.push(
    { label: "gd-light ink on surface", fg: ink, bg: surface, min: 4.5 },
    { label: "gd-light muted on surface", fg: muted, bg: surface, min: 4.5 },
    { label: "gd-light teal on surface", fg: teal, bg: surface, min: 4.5 },
    { label: "gd-light coral on surface", fg: coral, bg: surface, min: 4.5 },
    { label: "gd-light primaryInk on primary", fg: primaryInk, bg: primary, min: 4.5 }
  );
}

if (darkMatch) {
  const b = darkMatch[1];
  const surface = extractCssVar(b, "--gd-surface") || "#3b302c";
  const ink = extractCssVar(b, "--gd-ink") || "#fff6e9";
  const muted = extractCssVar(b, "--gd-muted") || "#e5d5c7";
  const teal = extractCssVar(b, "--gd-teal") || "#75dac0";
  const coral = extractCssVar(b, "--gd-coral") || "#ff9177";
  const primary = extractCssVar(b, "--gd-primary") || "#f3ddca";
  const primaryInk = extractCssVar(b, "--gd-primary-ink") || "#231a16";
  pairs.push(
    { label: "gd-dark ink on surface", fg: ink, bg: surface, min: 4.5 },
    { label: "gd-dark muted on surface", fg: muted, bg: surface, min: 4.5 },
    { label: "gd-dark teal on surface", fg: teal, bg: surface, min: 4.5 },
    { label: "gd-dark coral on surface", fg: coral, bg: surface, min: 4.5 },
    { label: "gd-dark primaryInk on primary", fg: primaryInk, bg: primary, min: 4.5 }
  );
}

let failures = 0;
for (const p of pairs) {
  const ratio = contrastRatio(p.fg, p.bg);
  const ok = ratio >= p.min;
  if (!ok) failures += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${p.label}: ${ratio.toFixed(2)}:1 (min ${p.min}:1)`
  );
}

if (failures > 0) {
  console.error(`\n${failures} contrast pair(s) below WCAG AA threshold.`);
  process.exit(1);
}
console.log(`\nAll ${pairs.length} contrast pairs meet WCAG AA.`);
