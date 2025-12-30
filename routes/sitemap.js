const express = require("express");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

const router = express.Router();

const BASE_URL = "https://mantraid.my.id";
const BUCKET = "manga-storage-1";
const DATA_DIR = path.join(__dirname, "../data");

async function getChaptersFromBucket(slug) {
  const prefix = `${slug}/`;
  const listUrl =
    `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o?` +
    `prefix=${encodeURIComponent(prefix)}&delimiter=/`;

  const resp = await fetch(listUrl);
  const data = await resp.json();

  return (data.prefixes || [])
    .map(p => p.replace(prefix, "").replace("/", ""))
    .filter(Boolean);
}

router.get("/sitemap.xml", async (req, res) => {
  try {
    const indexPath = path.join(DATA_DIR, "index.json");
    const mangaIndex = JSON.parse(fs.readFileSync(indexPath, "utf8"));

    const today = new Date().toISOString().split("T")[0];
    const urls = [];

    // ================= BASIC URLS =================
    urls.push({
      loc: `${BASE_URL}/`,
      priority: "1.0",
      lastmod: today
    });

    urls.push({
      loc: `${BASE_URL}/manga`,
      priority: "0.9",
      lastmod: today
    });

    // ================= MANGA + CHAPTER =================
    for (const manga of Object.values(mangaIndex.manga_list)) {
      if (!manga.id) continue;

      // Manga page
      urls.push({
        loc: `${BASE_URL}/manga/${manga.id}`,
        priority: "0.8",
        lastmod: today
      });

      // Chapters from GCS
      let chapters = [];
      try {
        chapters = await getChaptersFromBucket(manga.id);
      } catch (e) {
        console.error(`❌ GCS error (${manga.id})`, e.message);
      }

      for (const ch of chapters) {
        urls.push({
          loc: `${BASE_URL}/manga/${manga.id}/${ch}`,
          priority: "0.6",
          lastmod: today
        });
      }
    }

    // ================= XML BUILD (NO NEWLINE IN <loc>) =================
    const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u =>
`<url>
<loc>${u.loc}</loc>
<lastmod>${u.lastmod}</lastmod>
<priority>${u.priority}</priority>
</url>`
).join("")}
</urlset>`;

    res.setHeader("Content-Type", "application/xml");
    res.send(xml);

  } catch (err) {
    console.error("❌ Sitemap fatal error:", err);
    res.status(500).send("Sitemap error");
  }
});

module.exports = router;
