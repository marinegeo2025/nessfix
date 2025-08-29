// api/card.png.js
import { scrapeLHFA } from "./_scrape.js";
import { buildSVG } from "./_card-template.js";
import { Resvg } from "@resvg/resvg-js";

export default async function handler(req, res) {
  try {
    const data = await scrapeLHFA();
    const svg = buildSVG(data);

    const r = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 }, // nice crisp PNG
      textRendering: 1
    });

    const png = r.render().asPng();

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=86400");
    res.setHeader("Content-Disposition", 'inline; filename="nessfix-card.png"');
    res.status(200).send(Buffer.from(png));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
