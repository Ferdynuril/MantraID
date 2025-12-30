const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

const BASE_URL = "https://mantraid.my.id";
const BUCKET = "manga-storage-1";
const DATA_DIR = path.join(__dirname, "../data");
const PUBLIC_DIR = path.join(__dirname, "../public");
const SITEMAP_PATH = path.join(PUBLIC_DIR, "sitemap.xml");

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

async function generateSitemap() {
  console.log("🗺 Generating sitemap.xml...");

  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  const indexPath = path.join(DATA_DIR, "index.json");
  const mangaIndex = JSON.parse(fs.readFileSync(indexPath, "utf8"));

  let urls = [
    { loc: `${BASE_URL}/`, priority: "1.0" },
    { loc: `${BASE_URL}/manga`, priority: "0.9" },
  ];

  const mangaList = Object.values(mangaIndex.manga_list || {}).filter(m => m.id);

  // ⚡ Parallel fetch chapters (sekali saat startup)
  const chapterResults = await Promise.allSettled(
    mangaList.map(m => getChaptersFromBucket(m.id))
  );

  mangaList.forEach((manga, i) => {
    urls.push({
      loc: `${BASE_URL}/manga/${manga.id}`,
      priority: "0.8",
    });

    if (chapterResults[i].status === "fulfilled") {
      chapterResults[i].value.forEach(ch => {
        urls.push({
          loc: `${BASE_URL}/manga/${manga.id}/${ch}`,
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

  fs.writeFileSync(SITEMAP_PATH, xml, "utf8");

  console.log(`✅ Sitemap generated: ${SITEMAP_PATH}`);
}

module.exports = generateSitemap;
