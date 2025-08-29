// scripts/scrape.js
import fs from "fs";
import puppeteer from "puppeteer";

const URL = "https://www.lhfa.org.uk/league/";

const norm = (s) => (s || "").replace(/\s+/g, " ").trim();

// Safer header key: lowercased, alphas only
const key = (s) => (s || "").toLowerCase().replace(/[^a-z]/g, "");

function parseDdMmYyyy(s) {
  const m = (s || "").match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/);
  if (!m) return null;
  const dd = String(m[1]).padStart(2, "0");
  const mm = String(m[2]).padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function cleanMid(midRaw) {
  let s = norm(midRaw);
  s = s.replace(/\b(\d{1,2}):(\d{2}):00\b/g, "$1:$2");     // 18:30:00 -> 18:30
  s = s.replace(/(\b\d{1,2}:\d{2})(?::00)?\1\b/g, "$1");   // 18:30:0018:30 -> 18:30
  return s;
}

// new: robust date parser that accepts ISO or dd/mm/yyyy anywhere in the string
function parseDateCell(s) {
  const t = s || "";
  const iso = t.match(/(\d{4}-\d{2}-\d{2})/);              // e.g. 2025-04-11
  if (iso) return iso[1];
  const dm = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);     // e.g. 11/04/2025
  if (dm) {
    const dd = String(dm[1]).padStart(2, "0");
    const mm = String(dm[2]).padStart(2, "0");
    return `${dm[3]}-${mm}-${dd}`;
  }
  return norm(t);
}

const TIME_RE = /^\d{1,2}:\d{2}$/;

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    );
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });

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
      const rowCount =
        t.querySelectorAll("tbody tr").length || t.querySelectorAll("tr").length;
      if (rowCount >= 5) return true;
    }
  }
  return false;
}, { timeout: 60000 });

    const { standings, fixturesRaw } = await page.evaluate(() => {
      const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
      const key = (s) => (s || "").toLowerCase().replace(/[^a-z]/g, "");

      const out = { standings: [], fixturesRaw: [] };
      const tables = Array.from(document.querySelectorAll("table"));

      // League table assumed first table (as per LHFA today)
      if (tables[0]) {
        const t = tables[0];
        const rows = Array.from(t.querySelectorAll("tbody tr, tr"));
        for (const tr of rows) {
          const tds = tr.querySelectorAll("td");
          if (tds.length >= 3) {
            const pos = norm(tds[0]?.textContent);
            const team = norm(tds[1]?.textContent);
            const points = norm(tds[tds.length - 1]?.textContent);
            if (team) out.standings.push({ pos, team, points });
          }
        }
      }

      // Find fixtures table: must include date+home+away and (score OR time) in headers
      const fixturesTable = tables.find((t) => {
        const heads = Array.from(t.querySelectorAll("thead th, tr:first-child th, tr:first-child td"))
          .map((el) => key(el.textContent));
        const hasDate = heads.some((h) => h.includes("date"));
        const hasHome = heads.some((h) => h.includes("home"));
        const hasAway = heads.some((h) => h.includes("away"));
        const midOk =
          heads.some((h) => h.includes("score")) ||
          heads.some((h) => h.includes("time")) ||
          heads.some((h) => h.includes("timescore")) ||
          heads.some((h) => h.includes("scoretime"));
        return hasDate && hasHome && hasAway && midOk;
      });

      if (fixturesTable) {
        const rows = Array.from(fixturesTable.querySelectorAll("tbody tr, tr"));
        for (const tr of rows) {
          const tds = tr.querySelectorAll("td");
          if (tds.length >= 4) {
            out.fixturesRaw.push({
              date: norm(tds[0]?.textContent), // dd/mm/yyyy
              home: norm(tds[1]?.textContent),
              mid:  norm(tds[2]?.textContent), // time or score
              away: norm(tds[3]?.textContent),
              ground: tds[4] ? norm(tds[4].textContent) : ""
            });
          }
        }
      }

      return out;
    });

    // Normalise + filter to Ness-only
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

    fs.mkdirSync("./data", { recursive: true });
    fs.writeFileSync("./data/latest.json", JSON.stringify({ standings, fixtures }, null, 2));
    console.log(`✅ Scraped: standings=${standings.length}, ness fixtures=${fixtures.length}`);
  } catch (err) {
    console.error("❌ scrape failed:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
