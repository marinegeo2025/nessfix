// the api/_scrape.js
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

const URL = "https://www.lhfa.org.uk/league/";
const NORM = (s) => (s || "").replace(/\s+/g, " ").trim();

// --- helpers (unchanged) ---
function cleanMid(midRaw) {
  let s = NORM(midRaw);
  s = s.replace(/\b(\d{1,2}):(\d{2}):00\b/g, "$1:$2");
  s = s.replace(/(\b\d{1,2}:\d{2})(?::00)?\1\b/g, "$1");
  return s;
}
function parseDateCell(s) {
  const t = s || "";
  const iso = t.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const dm = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dm) return `${dm[3]}-${String(dm[2]).padStart(2, "0")}-${String(dm[1]).padStart(2, "0")}`;
  return NORM(t);
}
const TIME_RE = /^\d{1,2}:\d{2}$/;

export async function scrapeLHFA() {
  // Launch the serverless Chromium that ships with @sparticuz/chromium
  const executablePath = await chromium.executablePath();

  const browser = await puppeteer.launch({
    executablePath,
    args: chromium.args,             // serverless-friendly flags
    headless: "shell",               // recommended headless mode for CfT/headless_shell
    defaultViewport: { width: 1200, height: 800 }
  });

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(60000);

    await page.setExtraHTTPHeaders({ "Accept-Language": "en-GB,en;q=0.9" });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    );

    // Speed up: block images/media/fonts (leave CSS/JS)
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const rt = req.resourceType();
      if (rt === "image" || rt === "media" || rt === "font") return req.abort();
      return req.continue();
    });

    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });

    // Wait for a fixtures-like table (date+home+away + time/score)
    await page.waitForFunction(() => {
      const N = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
      const tables = Array.from(document.querySelectorAll("table"));
      for (const t of tables) {
        const heads = Array.from(t.querySelectorAll("thead th, tr:first-child th, tr:first-child td"))
          .map((el) => N(el.textContent));
        const hasDate = heads.some((h) => h.includes("date"));
        const hasHome = heads.some((h) => h.includes("home"));
        const hasAway = heads.some((h) => h.includes("away"));
        const midOk = heads.some((h) => h.includes("score")) || heads.some((h) => h.includes("time"));
        if (hasDate && hasHome && hasAway && midOk) {
          const rows = t.querySelectorAll("tbody tr").length || t.querySelectorAll("tr").length;
          if (rows >= 5) return true;
        }
      }
      return false;
    }, { timeout: 60000 });

    const { standings, fixturesRaw } = await page.evaluate(() => {
      const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
      const key  = (s) => (s || "").toLowerCase().replace(/[^a-z]/g, "");
      const out = { standings: [], fixturesRaw: [] };
      const tables = Array.from(document.querySelectorAll("table"));

      // ---- League table (first table) - robust header mapping ----
      if (tables[0]) {
        const t = tables[0];

        const headKeys = Array.from(
          t.querySelectorAll("thead th, tr:first-child th, tr:first-child td")
        ).map(el => key(el.textContent));

        // Map header tokens to our fields
        const mapHeader = (h) => {
          if (!h) return "";
          if (h === "club" || h === "team") return "team";
          if (h === "pts"  || h === "points") return "points";
          // keep known short codes as-is
          if (["p","w","d","l","f","a","gd"].includes(h)) return h;
          return "";
        };
        const cols = headKeys.map(mapHeader);

        const rows = Array.from(t.querySelectorAll("tbody tr, tr"));
        for (const tr of rows) {
          const tds = Array.from(tr.querySelectorAll("td"));
          if (tds.length < 3) continue;

          const cells = tds.map(td => norm(td.textContent));
          // LHFA has a leading position number in col 0
          const pos = cells[0];

          const rec = { pos, team: "", points: "" };
          cols.forEach((k, i) => {
            if (!k) return;
            const v = cells[i] ?? "";
            if (k === "team")   rec.team   = v;
            else if (k === "points") rec.points = v;
            else rec[k] = v; // p,w,d,l,f,a,gd
          });

          // Fallbacks if headers weren't detected
          if (!rec.team && cells[1])    rec.team   = cells[1];
          if (!rec.points && cells.at(-1)) rec.points = cells.at(-1);

          if (rec.team) out.standings.push(rec);
        }
      }

      // ---- Fixtures table (unchanged) ----
      const fixturesTable = tables.find((t) => {
        const heads = Array.from(t.querySelectorAll("thead th, tr:first-child th, tr:first-child td"))
          .map((el) => norm(el.textContent).toLowerCase());
        const hasDate = heads.some((h) => h.includes("date"));
        const hasHome = heads.some((h) => h.includes("home"));
        const hasAway = heads.some((h) => h.includes("away"));
        const midOk = heads.some((h) => h.includes("time")) || heads.some((h) => h.includes("score"));
        return hasDate && hasHome && hasAway && midOk;
      });

      if (fixturesTable) {
        const rows = Array.from(fixturesTable.querySelectorAll("tbody tr, tr"));
        for (const tr of rows) {
          const tds = tr.querySelectorAll("td");
          if (tds.length >= 4) {
            out.fixturesRaw.push({
              date: norm(tds[0]?.textContent),
              home: norm(tds[1]?.textContent),
              mid:  norm(tds[2]?.textContent),
              away: norm(tds[3]?.textContent),
              ground: tds[4] ? norm(tds[4].textContent) : ""
            });
          }
        }
      }

      return out;
    });

    const fixtures = fixturesRaw
      .map((r) => {
        const date = parseDateCell(r.date);
        const mid = cleanMid(r.mid);
        const isTime = TIME_RE.test(mid);
        return {
          date,
          time: isTime ? mid : "",
          home: r.home,
          away: r.away,
          result: isTime ? "" : mid,
          ground: r.ground
        };
      })
      .filter((f) => /ness/i.test(f.home) || /ness/i.test(f.away))
      .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));

    return { standings, fixtures, updatedAt: new Date().toISOString() };
  } finally {
    await browser.close();
  }
}
