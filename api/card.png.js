// api/card.png.js
 import { scrapeLHFA } from "./_scrape.js";
 import { buildSVG } from "./_card-template.js";
 import { Resvg } from "@resvg/resvg-js";
+import fs from "fs";

 export default async function handler(req, res) {
   try {
     const data = await scrapeLHFA();
     const svg = buildSVG(data);

-    const r = new Resvg(svg, {
-     fitTo: { mode: "width", value: 1200 },
-     textRendering: 1,
-     font: { loadSystemFonts: true }   // <-- allow fallback fonts if present
-   });
+    // Load bundled fonts
+    const fontRegular = fs.readFileSync("./fonts/GeogrotesqueCompTRIAL-Rg.otf");
+    const fontBold    = fs.readFileSync("./fonts/GeogrotesqueCondTRIAL-Bd.otf");
+
+    const r = new Resvg(svg, {
+      fitTo: { mode: "width", value: 1200 },
+      textRendering: 1,
+      font: { fontFiles: [fontRegular, fontBold] }
+    });

     const png = r.render().asPng();

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store, must-revalidate");
    res.setHeader("Content-Disposition", 'inline; filename="nessfix-card.png"');
    res.status(200).send(Buffer.from(png));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
