const fs = require("fs");
const path = require("path");
const { db } = require("../config/firebase");



/**
 * HOME CONTROLLER
 * --------------------------------------------------
 * - Load latest.json
 * - Load index.json (metadata)
 * - Load populer.json (views)
 * - Merge + sort (latest / popular)
 */

exports.index = async (req, res) => {
  try {
    const DATA_DIR = path.join(__dirname, "../data");

    const latestPath = path.join(DATA_DIR, "latest.json");
    const indexPath  = path.join(DATA_DIR, "index.json");

    if (!fs.existsSync(latestPath) || !fs.existsSync(indexPath)) {
      return res.render("home", {
        latest: [],
        popularDay: [],
        popularWeek: [],
        popularMonth: []
      });
    }

    // ===== LOAD JSON =====
    const latestData = JSON.parse(fs.readFileSync(latestPath, "utf8"));
    const indexData  = JSON.parse(fs.readFileSync(indexPath, "utf8"));

    // ===== META MAP =====
    const metaMap = {};
    indexData.manga_list.forEach(m => {
      metaMap[m.id.toLowerCase()] = m;
    });

    // ===== BUILD MANGA LIST =====
    const mangas = Object.entries(latestData).map(([slug, info]) => {
      const meta = metaMap[slug] || {};

      return {
        slug,
        title: meta.title || slug.replace(/-/g, " "),
        cover: info.cover || "/img/no-cover.jpg",
        project: meta.project || false,
        chapters: (info.latestChapters || []).map(c => ({
          chapter: c.chapter.replace("-", "."),
          url: c.chapter,
          updated: formatDate(c.updated),
          updatedRaw: c.updated,
          ago: timeAgo(c.updated)
        })),
        genre: meta.genre || [],
        status: meta.status || "Unknown"
      };
    });

    // ===== FIRESTORE POPULAR =====
    const popularDay   = await getPopularRange(1);
    const popularWeek  = await getPopularRange(7);
    const popularMonth = await getPopularRange(30);

    mangas.forEach(m => {
      m.populerDay   = popularDay[m.slug]   || 0;
      m.populerWeek  = popularWeek[m.slug]  || 0;
      m.populerMonth = popularMonth[m.slug] || 0;
    });

    // ===== SORTING =====
    const latest = [...mangas].sort((a, b) => {
      const ad = new Date(a.chapters[0]?.updatedRaw || 0);
      const bd = new Date(b.chapters[0]?.updatedRaw || 0);
      return bd - ad;
    });

    const day   = [...mangas].sort((a, b) => b.populerDay   - a.populerDay);
    const week  = [...mangas].sort((a, b) => b.populerWeek  - a.populerWeek);
    const month = [...mangas].sort((a, b) => b.populerMonth - a.populerMonth);

    res.render("home", {
      latest,
      popularDay: day,
      popularWeek: week,
      popularMonth: month
    });

  } catch (err) {
    console.error("HOME ERROR:", err);
    res.status(500).send("Error memuat home");
  }
};


// ===================================================
// HELPERS
// ===================================================

async function getPopularRange(days = 1) {
  const result = {};
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateKey = d.toISOString().slice(0, 10);

    const doc = await db
      .collection("popular_daily")
      .doc(dateKey)
      .get();

    if (!doc.exists) continue;

    const data = doc.data();
    for (const [slug, count] of Object.entries(data)) {
      if (slug === "updatedAt") continue;
      result[slug] = (result[slug] || 0) + count;
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
