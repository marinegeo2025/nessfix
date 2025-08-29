// scripts/build.js
import fs from "fs";

const NESS = /^(?:ness)$/i;
const isNess = (s) => NESS.test((s || "").trim());

/** XML escape for SVG text nodes and attributes */
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Extract a clean YYYY-MM-DD from mixed cells (e.g. "2025-08-29 18:30:0029/08/2025") */
function cleanDate(s) {
  if (!s) return s;
  const str = String(s);
  const iso = str.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const dm = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dm) return `${dm[3]}-${String(dm[2]).padStart(2, "0")}-${String(dm[1]).padStart(2, "0")}`;
  return str.trim();
}

/** Normalise time tokens like 18:30:00 → 18:30 */
function cleanTime(s) {
  if (!s) return s;
  return String(s).replace(/\b(\d{1,2}):(\d{2}):00\b/g, "$1:$2").trim();
}

/** Keep any time token out of result, handle placeholders, clean date & time */
function normaliseFixtures(rows) {
  return (rows || []).map((f) => {
    let date   = cleanDate(f.date);
    let time   = cleanTime(f.time || "");
    let result = (f.result || "").trim();

    // Move embedded times from result → time
    const timeTokens = (result + " " + time).match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g);
    if (!time && timeTokens?.length) time = cleanTime(timeTokens[0]);
    if (timeTokens?.length) result = result.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, "").trim();

    // Clean placeholders (no result yet)
    if (/^(?:-|v|vs|vs\.|tbc|tba)$/i.test(result)) result = "";

    return { ...f, date, time, result };
  });
}

function weekday(iso) {
  const [y, m, d] = (iso || "").split("-").map(Number);
  if (!y || !m || !d) return "-";
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "long" });
}

function htmlPage({ standings, fixtures }) {
  const up = fixtures.filter((f) => !f.result);
  const past = fixtures.filter((f) => !!f.result);

  const row = (f, showResult) => {
    const home = f.home || "";
    const away = f.away || "";
    const nessHome = isNess(home);
    const opponent = nessHome ? away : home;
    const location = nessHome ? "HOME (Fivepenny)" : (f.ground || `AWAY at ${home}`);

    return `
      <tr>
        <td>${f.date || "-"}</td>
        <td>${weekday(f.date)}</td>
        <td>${f.time || "-"}</td>
        <td>${opponent || "-"}</td>
        <td class="${nessHome ? "home" : ""}">${location}</td>
        <td>${showResult ? (f.result || "-") : "-"}</td>
      </tr>`;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>NessFix – Ness FC Fixtures</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { --green:#008000; }
    body { font-family: Arial, sans-serif; margin: 20px; background: #f9f9f9; color: #111; }
    h1 { background: var(--green); color: white; padding: 10px; text-align: center; }
    h2 { margin-top: 40px; border-bottom: 2px solid var(--green); padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; background:white; }
    th, td { padding: 8px; border: 1px solid #ccc; text-align: center; }
    tr:nth-child(even) { background: #f2f2f2; }
    .ness { background: #c6f6c6; font-weight: bold; }
    .home { color: var(--green); font-weight: bold; }
    .card { text-align:center; margin-top:30px; }
    .card img, .card object { max-width: 90%; border: 2px solid var(--green); }
    .grid { display:grid; gap:20px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
    .standings { overflow:auto; }
  </style>
</head>
<body>
  <h1>NessFix – League Table & Fixtures</h1>

  <div class="card">
    <h2>Fixture Card (SVG)</h2>
    <p><a href="/nessfix.svg" download>📥 Download Fixture Card (SVG)</a></p>
    <object data="/nessfix.svg" type="image/svg+xml" aria-label="NessFix Card"></object>
  </div>

  <div class="grid">
    <section class="standings">
      <h2>League Standings</h2>
      <table>
        <tr><th>Pos</th><th>Team</th><th>Points</th></tr>
        ${standings
          .map(
            (row) => `
        <tr class="${/ness/i.test(row.team) ? "ness" : ""}">
          <td>${row.pos}</td><td>${row.team}</td><td>${row.points}</td>
        </tr>`
          )
          .join("")}
      </table>
    </section>

    <section>
      <h2>Upcoming Ness Fixtures (${up.length})</h2>
      <table>
        <tr><th>Date</th><th>Weekday</th><th>Time</th><th>Opponent</th><th>Location</th><th>Result</th></tr>
        ${
          up.length
            ? up.map((f) => row(f, false)).join("")
            : `<tr><td colspan="6">No upcoming Ness fixtures found.</td></tr>`
        }
      </table>

      <h2>Past Ness Results (${past.length})</h2>
      <table>
        <tr><th>Date</th><th>Weekday</th><th>Time</th><th>Opponent</th><th>Location</th><th>Result</th></tr>
        ${
          past.length
            ? past.map((f) => row(f, true)).join("")
            : `<tr><td colspan="6">No past results parsed.</td></tr>`
        }
      </table>
    </section>
  </div>

  <p style="margin-top:40px; font-size:12px; text-align:center;">
    Data source: LHFA • Last built: ${new Date().toLocaleString("en-GB")}
  </p>
</body>
</html>`;
}

function svgCard({ standings, fixtures }) {
  const up = fixtures.filter((f) => !f.result).slice(0, 8);

  // Layout
  const W = 900, H = 1200, M = 40;
  const headerH = 110;
  const colGap = 30;
  const colW = (W - 2 * M - colGap) / 2;

  const sRows = standings
    .map((r, i) => {
      const isN = /ness/i.test(r.team);
      const y = headerH + M + 30 + i * 28;
      return `<text x="${M + 12}" y="${y}" font-size="20" font-weight="${isN ? "700" : "400"}" fill="${isN ? "#008000" : "#111"}">${esc(`${i + 1}. ${r.team}`)}</text>
              <text x="${M + colW - 12}" y="${y}" font-size="20" text-anchor="end" fill="${isN ? "#008000" : "#111"}">${esc(`${r.points} pts`)}</text>`;
    })
    .join("\n");

  const fRows = (up.length ? up : fixtures.slice(0, 8))
    .map((f, i) => {
      const y = headerH + M + 30 + i * 32;
      const homeIsNess = isNess(f.home);
      const matchup = `${f.home} vs ${f.away}`;
      const when = [f.date, f.time].filter(Boolean).join(" ");
      return `<text x="${M + colW + colGap + 12}" y="${y}" font-size="18" font-weight="${homeIsNess ? "700" : "400"}" fill="${homeIsNess ? "#008000" : "#111"}">${esc(matchup)}</text>
              <text x="${W - M - 12}" y="${y}" font-size="18" text-anchor="end" fill="#444">${esc(when || "-")}</text>`;
    })
    .join("\n");

  const subtitle = `NESSFIX — Fixtures & League Table`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#008000"/>
      <stop offset="1" stop-color="#1a8f1a"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>
  <rect x="0" y="0" width="${W}" height="${headerH}" fill="url(#g)"/>
  <text x="${W / 2}" y="${headerH / 2 + 10}" font-size="36" font-weight="700" fill="#fff" text-anchor="middle">${esc(subtitle)}</text>

  <text x="${M + 12}" y="${headerH + 24}" font-size="22" font-weight="700" fill="#111">League Standings</text>
  <text x="${M + colW + colGap + 12}" y="${headerH + 24}" font-size="22" font-weight="700" fill="#111">Upcoming Fixtures</text>

  ${sRows}
  ${fRows}

  <text x="${W / 2}" y="${H - 20}" font-size="14" fill="#333" text-anchor="middle">
    ${esc(`Built ${new Date().toLocaleDateString("en-GB")} • ${up.length} upcoming shown`)}
  </text>
  <rect x="${M}" y="${headerH + 10}" width="${colW}" height="${H - headerH - 60}" fill="none" stroke="#ddd"/>
  <rect x="${M + colW + colGap}" y="${headerH + 10}" width="${colW}" height="${H - headerH - 60}" fill="none" stroke="#ddd"/>
</svg>`;
}

(function main() {
  let data;
  try {
    data = JSON.parse(fs.readFileSync("./data/latest.json", "utf8"));
  } catch (e) {
    console.error("❌ missing ./data/latest.json — run `npm run scrape` first");
    process.exit(1);
  }

  const standings = Array.isArray(data.standings) ? data.standings : [];
  let fixtures = Array.isArray(data.fixtures) ? data.fixtures : [];

  // Normalise then sort by date+time
  fixtures = normaliseFixtures(fixtures);
  fixtures.sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));

  fs.mkdirSync("./public", { recursive: true });

  // HTML
  const html = htmlPage({ standings, fixtures });
  fs.writeFileSync("./public/index.html", html);

  // SVG card
  const svg = svgCard({ standings, fixtures });
  fs.writeFileSync("./public/nessfix.svg", svg);

  console.log("✅ Built public/index.html and public/nessfix.svg");
})();
