const fs = require("fs");
const path = require("path");


/**
 * HOME CONTROLLER
 * --------------------------------------------------
 * - Load latest.json
 * - Load index.json (metadata)
 * - Load populer.json (views)
 * - Merge + sort (latest / popular)
 */

exports.index = (req, res) => {
  try {
    const DATA_DIR = path.join(__dirname, "../data");

    const latestPath  = path.join(DATA_DIR, "latest.json");
    const indexPath   = path.join(DATA_DIR, "index.json");
    const populerPath = path.join(DATA_DIR, "populer.json");

    if (!fs.existsSync(latestPath) || !fs.existsSync(indexPath)) {
      return res.render("home", {
        latest: [],
        popularDay: [],
        popularWeek: [],
        popularMonth: []
      });
    }

    // ===== LOAD JSON (ONCE) =====
    const latestData  = JSON.parse(fs.readFileSync(latestPath, "utf8"));
    const indexData   = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    const populerData = fs.existsSync(populerPath)
      ? JSON.parse(fs.readFileSync(populerPath, "utf8"))
      : {};

    // ===== BUILD META MAP =====
    const metaMap = {};
    indexData.manga_list.forEach(m => {
      metaMap[m.id.toLowerCase()] = m;
    });

    // ===== BUILD MANGA LIST =====
    const mangas = Object.entries(latestData).map(([slug, info]) => {
      const meta = metaMap[slug] || {};

      const chapters = (info.latestChapters || []).map(c => ({
        chapter: c.chapter.replace("-", "."),
        url: c.chapter,
        updated: formatDate(c.updated),
        updatedRaw: c.updated,
        ago: timeAgo(c.updated)
      }));

      return {
        slug,
        title: meta.title || slug.replace(/-/g, " "),
        cover: info.cover || "/img/no-cover.jpg",
        project: meta.project || false,
        chapters,
        genre: meta.genre || [],
        status: meta.status || "Unknown"
      };
    });

    // ===== POPULARITY =====
    const populerDay   = getPopularity(populerData, "day");
    const populerWeek  = getPopularity(populerData, "week");
    const populerMonth = getPopularity(populerData, "month");

    mangas.forEach(m => {
      m.populerDay   = populerDay[m.slug]   || 0;
      m.populerWeek  = populerWeek[m.slug]  || 0;
      m.populerMonth = populerMonth[m.slug] || 0;
    });

    // ===== SORTING =====
    const mangasLatest = [...mangas].sort((a, b) => {
      const ad = new Date(a.chapters[0]?.updatedRaw || 0);
      const bd = new Date(b.chapters[0]?.updatedRaw || 0);
      return bd - ad;
    });

    const mangasDay   = [...mangas].sort((a, b) => b.populerDay   - a.populerDay);
    const mangasWeek  = [...mangas].sort((a, b) => b.populerWeek  - a.populerWeek);
    const mangasMonth = [...mangas].sort((a, b) => b.populerMonth - a.populerMonth);

    // ===== RENDER =====
    res.render("home", {
      latest: mangasLatest,
      popularDay: mangasDay,
      popularWeek: mangasWeek,
      popularMonth: mangasMonth
    });

  } catch (err) {
    console.error("HOME ERROR:", err);
    res.status(500).send("Error membaca data");
  }
};

// ===================================================
// HELPERS
// ===================================================

function getPopularity(populerData, range = "day") {
  const startDate = new Date();
  if (range === "day") startDate.setDate(startDate.getDate() - 1);
  if (range === "week") startDate.setDate(startDate.getDate() - 7);
  if (range === "month") startDate.setMonth(startDate.getMonth() - 1);

  const result = {};

  for (const dateStr in populerData) {
    if (new Date(dateStr) < startDate) continue;

    for (const slug in populerData[dateStr]) {
      result[slug] = (result[slug] || 0) + Number(populerData[dateStr][slug]);
    }
  }

  return result;
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function timeAgo(dateString) {
  const diff = Date.now() - new Date(dateString);
  const s = diff / 1000;
  const m = s / 60;
  const h = m / 60;
  const d = h / 24;

  if (s < 60) return `${Math.floor(s)} detik lalu`;
  if (m < 60) return `${Math.floor(m)} menit lalu`;
  if (h < 24) return `${Math.floor(h)} jam lalu`;
  if (d < 30) return `${Math.floor(d)} hari lalu`;
  if (d < 365) return `${Math.floor(d / 30)} bulan lalu`;
  return `${Math.floor(d / 365)} tahun lalu`;
}

exports.about = (req, res) => {
  res.send("Ini halaman About (controller)");
};
