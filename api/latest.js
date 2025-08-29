// api/latest.js
import { scrapeLHFA } from "./_scrape.js";

export default async function handler(req, res) {
  try {
    const data = await scrapeLHFA();

    // Cache at the CDN for 5 minutes; refresh automatically after that.
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=86400");
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
