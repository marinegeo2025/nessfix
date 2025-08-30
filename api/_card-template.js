// api/_card-template.js
const isNess = (s) => /^(?:ness)$/i.test((s || "").trim());
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const COLORS = {
  cream: "#f6f1de",
  header: "#4f6a2d",
  text: "#222222",
  ness: "#2f7d2f",
  footer: "#000000"
};

function weekday(iso) {
  const [y, m, d] = (iso || "").split("-").map(Number);
  if (!y || !m || !d) return "-";
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "long" });
}

export function buildSVG({ standings, fixtures, updatedAt }) {
  const W = 800, H = 1000;
  const headerH = 80;

  // spacing system (like build.js)
  const rowH = 28;          // line height for standings
  const titleGap = 50;      // gap under section titles
  const sectionGap = 30;    // gap between sections

  // show next 3 fixtures
  const upcoming = (fixtures || []).filter(f => !f.result).slice(0, 3);

  // --- positions for the standings block
  const standingsTitleY = headerH + 50;
  const standingsListY  = standingsTitleY + titleGap;

  // standings rows
  const standingsRows = (standings || []).map((r, i) => {
    const y = standingsListY + i * rowH;
    const nes = isNess(r.team);
    return `
      <text x="${W/2 - 120}" y="${y}" font-size="20" font-weight="${nes ? "700" : "400"}"
            fill="${nes ? COLORS.ness : COLORS.text}">${esc(`${i+1}. ${r.team}`)}</text>
      <text x="${W/2 + 120}" y="${y}" font-size="20" text-anchor="end"
            fill="${nes ? COLORS.ness : COLORS.text}">${esc(r.points + " pts")}</text>
    `;
  }).join("");

  // compute where the next section begins (just after the last standings row)
  const standingsHeight = (standings?.length || 0) * rowH;
  const upcomingTitleY  = standingsListY + standingsHeight + sectionGap;
  const fixturesListY   = upcomingTitleY + titleGap;

  // fixtures rows (leave generous spacing)
  const fxRows = upcoming.map((f, i) => {
    const y = fixturesListY + i * 80;
    const homeIsNess = isNess(f.home);
    const wd = (() => {
      const [Y, M, D] = (f.date || "").split("-").map(Number);
      return Y && M && D ? new Date(Y, M - 1, D).toLocaleDateString("en-GB", { weekday: "long" }) : "-";
    })();
    const line = `${wd} ${f.date} ${f.time || ""} – ${f.home} vs ${f.away}`;
    return `
      <text x="${W/2}" y="${y}" font-size="22" text-anchor="middle"
            font-weight="${homeIsNess ? "700" : "500"}"
            fill="${homeIsNess ? COLORS.ness : COLORS.text}">
        ${esc(line)}
      </text>
    `;
  }).join("");

  const updated = new Date(updatedAt || Date.now())
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    text { font-family: "Corbel", Arial, Helvetica, sans-serif; }
  </style>

  <rect width="${W}" height="${H}" fill="${COLORS.cream}"/>

  <!-- Header -->
  <rect x="0" y="0" width="${W}" height="${headerH}" fill="${COLORS.header}"/>
  <text x="${W/2}" y="${headerH/2 + 10}" font-size="28" font-weight="800" fill="#fff" text-anchor="middle">
    ${esc("NESS FC FIXTURES & LEAGUE TABLE")}
  </text>

  <!-- League Standings -->
  <text x="${W/2}" y="${standingsTitleY}" font-size="24" font-weight="700" fill="${COLORS.text}" text-anchor="middle">
    League Standings
  </text>
  ${standingsRows}

  <!-- Upcoming Fixtures -->
  <text x="${W/2}" y="${upcomingTitleY}" font-size="24" font-weight="700" fill="${COLORS.text}" text-anchor="middle">
    Upcoming Fixtures
  </text>
  ${fxRows}

  <!-- Footer -->
  <rect x="0" y="${H - 40}" width="${W}" height="40" fill="${COLORS.footer}"/>
  <text x="${W/2}" y="${H - 15}" font-size="16" fill="#ffffff" text-anchor="middle">
    Updated ${esc(updated)}
  </text>
</svg>`;
}
