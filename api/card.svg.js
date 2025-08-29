// api/card.svg.js
import { scrapeLHFA } from "./_scrape.js";
import { buildSVG } from "./_card-template.js";

export default async function handler(req, res) {
  try {
    const data = await scrapeLHFA();
    const svg = buildSVG(data);
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=86400");
    res.status(200).send(svg);
  } catch (e) {
    const msg = String(e).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    res.status(500).send(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200">
      <text x="20" y="100" font-size="20">Card error: ${msg}</text>
    </svg>`);
  }
}
