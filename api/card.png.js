// api/card.png.js
import { scrapeLHFA } from "./_scrape.js";
import { buildSVG } from "./_card-template.js";
import { Resvg } from "@resvg/resvg-js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fontRegularPath = path.join(__dirname, "..", "fonts", "GeogrotesqueCompTRIAL-Rg.otf");
const fontBoldPath    = path.join(__dirname, "..", "fonts", "GeogrotesqueCondTRIAL-Bd.otf");

export default async function handler(req, res) {
  try {
    const data = await scrapeLHFA();
    const svg = buildSVG(data);

    const r = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
      textRendering: 1,
      font: {
        // Let Resvg find any available fallback fonts too
        loadSystemFonts: true,
        // Primary fonts we ship with the repo
        fontFiles: [fontRegularPath, fontBoldPath],
        // This must match the family in the <style> block
        defaultFontFamily: "Geogrotesque",
      },
    });

    const png = r.render().asPng();
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store, must-revalidate");
    res.setHeader("Content-Disposition", 'inline; filename="nessfix-card.png"');
    res.status(200).send(Buffer.from(png));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
