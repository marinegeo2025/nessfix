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
  sub: "#444444",
  ness: "#2f7d2f",
  footer: "#0e0e0e"
};

function weekday(iso) {
  const [y, m, d] = (iso || "").split("-").map(Number);
  if (!y || !m || !d) return "-";
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "long" });
}

function fmtFixtureLine(f) {
  const wd = weekday(f.date);
  const dt = `${f.date}${f.time ? " " + f.time : ""}`;
  return `${wd} ${dt} – ${f.home} vs ${f.away}`;
}

/** Builds the cream-themed SVG card */
export function buildSVG({ standings, fixtures, updatedAt }) {
  const W = 900, H = 1200, M = 48;
  const headerH = 96;

  // Next N fixtures (change N easily)
  const SHOW_N = 3;
  const upcoming = fixtures.filter(f => !f.result).slice(0, SHOW_N);

  const standingsRows = (standings || []).map((r, i) => {
    const y = headerH + 110 + i * 36;
    const nes = /ness/i.test(r.team);
    const left = esc(`${i + 1}. ${r.team}`);
    const right = esc(`${r.points} pts`);
    return `
      <text x="${W/2 - 170}" y="${y}" font-size="22" font-weight="${nes ? "700" : "400"}"
            fill="${nes ? COLORS.ness : COLORS.text}">${left}</text>
      <text x="${W/2 + 170}" y="${y}" font-size="22" text-anchor="end"
            fill="${nes ? COLORS.ness : COLORS.text}">${right}</text>
    `;
  }).join("");

  const fxRows = (upcoming.length ? upcoming : fixtures.slice(0, SHOW_N))
    .map((f, i) => {
      const y = headerH + 410 + i * 90;  // generous spacing like your mock
      const line = fmtFixtureLine(f);
      const homeIsNess = isNess(f.home);
      return `
        <text x="${W/2}" y="${y}" font-size="26" text-anchor="middle"
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
  <rect width="${W}" height="${H}" fill="${COLORS.cream}"/>

  <!-- Header -->
  <rect x="0" y="24" width="${W}" height="${headerH}" rx="2" fill="${COLORS.header}"/>
  <text x="${W/2}" y="${24 + headerH/2 + 10}" font-size="40" font-weight="800" fill="#fff" text-anchor="middle">
    ${esc("NESS FC FIXTURES & LEAGUE TABLE")}
  </text>

  <!-- League title -->
  <text x="${W/2}" y="${headerH + 70}" font-size="30" font-weight="700" fill="${COLORS.text}" text-anchor="middle">
    League Standings
  </text>

  <!-- Standings panel outline -->
  <rect x="${M}" y="${headerH + 80}" width="${W - 2*M}" height="340" fill="none" stroke="#cfd8c0"/>

  ${standingsRows}

  <!-- Upcoming title -->
  <text x="${W/2}" y="${headerH + 380}" font-size="30" font-weight="700" fill="${COLORS.text}" text-anchor="middle">
    Upcoming Fixtures
  </text>

  ${fxRows}

  <!-- Footer -->
  <rect x="0" y="${H - 60}" width="${W}" height="60" fill="${COLORS.footer}"/>
  <text x="${W/2}" y="${H - 22}" font-size="20" fill="#ffffff" text-anchor="middle">Updated ${esc(updated)}</text>
</svg>`;
}
