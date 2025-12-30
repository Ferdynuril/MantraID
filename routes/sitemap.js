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

    let urls = [
      { loc: `${BASE_URL}/`, priority: "1.0" },
      { loc: `${BASE_URL}/manga`, priority: "0.9" },
    ];

    const mangaList = Object.values(mangaIndex.manga_list).filter(m => m.id);

    // 🚀 PARALLEL fetch chapters
    const chapterResults = await Promise.allSettled(
      mangaList.map(m => getChaptersFromBucket(m.id))
    );

    mangaList.forEach((manga, i) => {
      urls.push({
        loc: `${BASE_URL}/Manga/${manga.id}`,
        priority: "0.8",
      });

      if (chapterResults[i].status === "fulfilled") {
        chapterResults[i].value.forEach(ch => {
          urls.push({
            loc: `${BASE_URL}/Manga/${manga.id}/${ch}`.trim(),
            priority: "0.6",
          });
        });
      }
    });

    const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `
  <url>
    <loc>${u.loc}</loc>
    <priority>${u.priority}</priority>
  </url>
`).join("")}
</urlset>`;

    res.status(200);
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(xml);

  } catch (err) {
    console.error("Sitemap error:", err);
    res.status(500).send("Sitemap error");
  }
});


module.exports = router;
