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
    <p><a href="/api/card.png" download="nessfix-card.png">📥 Download Fixture Card (PNG)</a></p>
    <img src="/api/card.png" alt="NessFix Card" style="max-width:90%; border:2px solid var(--green);" />
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
  const W = 800, H = 1000;
  const COLORS = {
    cream: "#f6f1de",
    header: "#4f6a2d",
    text: "#222222",
    ness: "#2f7d2f",
    footer: "#000000"
  };

  const headerH = 80;
  const rowH = 28;
  const sectionGap = 30;      // gap between sections
  const titleGap = 50;        // gap between a section title and its list

  const up = (fixtures || []).filter(f => !f.result).slice(0, 3);

  // --- League Standings block ---
  const standingsTitleY = headerH + 50;
  const standingsListY  = standingsTitleY + titleGap;

  const standingsRows = (standings || []).map((r, i) => {
    const y = standingsListY + i * rowH;
    const nes = /^(?:ness)$/i.test((r.team || "").trim());
    return `
      <text x="${W/2 - 120}" y="${y}" font-size="20" font-weight="${nes ? "700" : "400"}"
            fill="${nes ? COLORS.ness : COLORS.text}">${esc(`${i+1}. ${r.team}`)}</text>
      <text x="${W/2 + 120}" y="${y}" font-size="20" text-anchor="end"
            fill="${nes ? COLORS.ness : COLORS.text}">${esc(r.points + " pts")}</text>
    `;
  }).join("");

  // compute where the next section should start (just below the last standings row)
  const standingsHeight = (standings?.length || 0) * rowH;
  const upcomingTitleY  = standingsListY + standingsHeight + sectionGap;
  const fixturesListY   = upcomingTitleY + titleGap;

  const fxRows = up.map((f, i) => {
    const y = fixturesListY + i * 80; // keep big spacing for fixtures
    const homeIsNess = /^(?:ness)$/i.test((f.home || "").trim());
    const wd = (d => {
      const [Y,M,D] = (d||"").split("-").map(Number);
      return Y && M && D ? new Date(Y, M-1, D).toLocaleDateString("en-GB", { weekday:"long" }) : "-";
    })(f.date);
    const line = `${wd} ${f.date} ${f.time || ""} – ${f.home} vs ${f.away}`;
    return `
      <text x="${W/2}" y="${y}" font-size="22" text-anchor="middle"
            font-weight="${homeIsNess ? "700" : "500"}"
            fill="${homeIsNess ? COLORS.ness : COLORS.text}">
        ${esc(line)}
      </text>
    `;
  }).join("");

  const updated = new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${COLORS.cream}"/>

  <!-- Header bar -->
  <rect x="0" y="0" width="${W}" height="${headerH}" fill="${COLORS.header}"/>
  <text x="${W/2}" y="${headerH/2 + 10}" font-size="28" font-weight="800" fill="#fff" text-anchor="middle">
    NESS FC FIXTURES &amp; LEAGUE TABLE
  </text>

  <!-- Standings -->
  <text x="${W/2}" y="${standingsTitleY}" font-size="24" font-weight="700" fill="${COLORS.text}" text-anchor="middle">
    League Standings
  </text>
  ${standingsRows}

  <!-- Upcoming -->
  <text x="${W/2}" y="${upcomingTitleY}" font-size="24" font-weight="700" fill="${COLORS.text}" text-anchor="middle">
    Upcoming Fixtures
  </text>
  ${fxRows}

  <!-- Footer -->
  <rect x="0" y="${H - 40}" width="${W}" height="40" fill="${COLORS.footer}"/>
  <text x="${W/2}" y="${H - 15}" font-size="16" fill="#ffffff" text-anchor="middle">Updated ${esc(updated)}</text>
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
