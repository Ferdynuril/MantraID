/**
 * Admin Controller
 * ----------------------------------------------------
 * - Authentication (login / logout)
 * - Dashboard data aggregation
 * - Statistics & analytics helpers
 */

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");

// ====================================================
// PATH CONSTANTS
// ====================================================
const DATA_DIR   = path.join(__dirname, "../data");
const ADMIN_PATH = path.join(DATA_DIR, "admin.json");
const LATEST_PATH  = path.join(DATA_DIR, "latest.json");
const POPULER_PATH = path.join(DATA_DIR, "populer.json");
const INDEX_PATH   = path.join(DATA_DIR, "index.json");

// ====================================================
// UTILITIES
// ====================================================

/** Read JSON file safely */
function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/** Create YYYY-MM-DD string from Date */
function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

// ====================================================
// AUTHENTICATION
// ====================================================

exports.showLogin = (req, res) => {
  if (req.session.admin) return res.redirect("/admin");
  res.render("admin-login");
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  const admin = readJSON(ADMIN_PATH);

  if (username !== admin.username) {
    return res.render("admin-login", { error: "Username salah" });
  }

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) {
    return res.render("admin-login", { error: "Password salah" });
  }

  // ✅ Login success
  req.session.admin = { username: admin.username };
  res.redirect("/admin");
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
};

// ====================================================
// DASHBOARD
// ====================================================

exports.dashboard = (req, res) => {
  try {
    // ===== LOAD DATA (ONCE) =====
    const latestData  = readJSON(LATEST_PATH);
    const populerData = readJSON(POPULER_PATH);
    const indexData   = readJSON(INDEX_PATH);

    // ===== BUILD META LOOKUP (O(1)) =====
    const metaMap = buildMetaMap(indexData.manga_list);

    // ===== POPULARITY MAPS =====
    const populerDayMap   = getPopularityByRange(populerData, "day");
    const populerWeekMap  = getPopularityByRange(populerData, "week");
    const populerMonthMap = getPopularityByRange(populerData, "month");

    // ===== MERGE MANGA DATA =====
    const mangas = Object.entries(latestData).map(([slug, info]) =>
      buildMangaObject(slug, info, metaMap, {
        day: populerDayMap,
        week: populerWeekMap,
        month: populerMonthMap
      })
    );

    // ===== GLOBAL STATISTICS =====
    const totalViews = {
      day:   getTotalViews(populerData, "day"),
      week:  getTotalViews(populerData, "week"),
      month: getTotalViews(populerData, "month"),
      all:   getTotalViews(populerData, "all")
    };

    const totalManga = countUniqueManga(indexData.manga_list);
    const viewsTrend = getViewsTrendLastDays(populerData, 7);

    // ===== RENDER =====
    res.render("dashboard", {
      admin: req.session.admin,
      mangas,
      totalViews,
      totalManga,
      viewsTrend
    });

  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).send("Gagal memuat dashboard admin");
  }
};

exports.mangaList = (req, res) => {
    try {
        // ===== LOAD DATA (ONCE) =====
        const latestData = readJSON(LATEST_PATH);
        const populerData = readJSON(POPULER_PATH);
        const indexData = readJSON(INDEX_PATH);

        // ===== BUILD META LOOKUP (O(1)) =====
        const metaMap = buildMetaMap(indexData.manga_list);
        // ===== POPULARITY MAPS =====
        const populerDayMap = getPopularityByRange(populerData, "day");
        const populerWeekMap = getPopularityByRange(populerData, "week");
        const populerMonthMap = getPopularityByRange(populerData, "month");
        // ===== MERGE MANGA DATA =====
        const mangas = Object.entries(latestData).map(([slug, info]) =>
            buildMangaObject(slug, info, metaMap, {
                day: populerDayMap,
                week: populerWeekMap,
                month: populerMonthMap
            })
        );
        // ===== RENDER =====
        res.render("list", {
            admin: req.session.admin,
            mangas
        });
    } catch (err) {
        console.error("Manga list error:", err);
        res.status(500).send("Gagal memuat daftar manga");
    }
};

exports.createManga = (req, res) => {
  try {
    const data = req.body;
    if (!data.title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const indexData  = readJSON(INDEX_PATH);
    const latestData = readJSON(LATEST_PATH);

    // ===== SLUG =====
    const slug = (data.id || data.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // ===== DUPLICATE CHECK =====
    if (indexData.manga_list.some(m => m.id === slug)) {
      return res.status(409).json({ error: "Manga already exists" });
    }

    const manga = {
      id: slug,
      project: Boolean(data.project),
      title: data.title,
      alternative_title: data.alternative_title || "",
      author: data.author || "",
      artist: data.artist || "",
      genre: Array.isArray(data.genre) ? data.genre : [],
      theme: Array.isArray(data.theme) ? data.theme : [],
      status: data.status || "Ongoing",
      release_year: Number(data.release_year) || new Date().getFullYear(),
      serialization: data.serialization || "",
      post: "Ferdynuril",
      rating: data.rating || "",
      description: data.description || "",
      createdAt: new Date().toISOString()
    };

    indexData.manga_list.push(manga);

    latestData[slug] = {
      cover: "/img/no-cover.jpg",
      latestChapters: []
    };

    saveJSON(INDEX_PATH, indexData);
    saveJSON(LATEST_PATH, latestData);

    res.json({ success: true, manga });
  } catch (err) {
    console.error("Create manga error:", err);
    res.status(500).json({ error: "Create manga failed" });
  }
};



exports.updateManga = (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const indexData = readJSON(INDEX_PATH);
    const manga = indexData.manga_list.find(m => m.id === id);

    if (!manga) {
      return res.status(404).json({ error: "Manga not found" });
    }

    Object.assign(manga, {
      title: data.title ?? manga.title,
      alternative_title: data.alternative_title ?? manga.alternative_title,
      author: data.author ?? manga.author,
      artist: data.artist ?? manga.artist,
      genre: Array.isArray(data.genre) ? data.genre : manga.genre,
      theme: Array.isArray(data.theme) ? data.theme : manga.theme,
      status: data.status ?? manga.status,
      release_year: data.release_year ? Number(data.release_year) : manga.release_year,
      serialization: data.serialization ?? manga.serialization,
      rating: data.rating ?? manga.rating,
      description: data.description ?? manga.description,
      project: data.project !== undefined ? Boolean(data.project) : manga.project
    });

    saveJSON(INDEX_PATH, indexData);

    res.json({ success: true, manga });
  } catch (err) {
    console.error("Update manga error:", err);
    res.status(500).json({ error: "Update manga failed" });
  }
};



exports.deleteManga = (req, res) => {
  try {
    const { id } = req.params;

    const indexData = readJSON(INDEX_PATH);
    const latestData = readJSON(LATEST_PATH);
    const populerData = fs.existsSync(POPULER_PATH)
      ? readJSON(POPULER_PATH)
      : {};

    const exists = indexData.manga_list.some(m => m.id === id);
    if (!exists) {
      return res.status(404).json({ error: "Manga not found" });
    }

    indexData.manga_list = indexData.manga_list.filter(m => m.id !== id);
    delete latestData[id];

    for (const date in populerData) {
      delete populerData[date]?.[id];
    }

    saveJSON(INDEX_PATH, indexData);
    saveJSON(LATEST_PATH, latestData);
    saveJSON(POPULER_PATH, populerData);

    res.json({ success: true });
  } catch (err) {
    console.error("Delete manga error:", err);
    res.status(500).json({ error: "Delete manga failed" });
  }
};






// ====================================================
// DATA BUILDERS
// ====================================================

function buildMetaMap(mangaList = []) {
  const map = {};
  mangaList.forEach(m => {
    map[m.id.toLowerCase()] = m;
  });
  return map;
}

function buildMangaObject(slug, info, metaMap, populerMaps) {
  const meta = metaMap[slug] || {};

  return {
    slug,
    id: meta.id || slug,
    title: meta.title || slug.replace(/-/g, " "),
    alternative_title: meta.alternative_title || "",
    author: meta.author || "-",
    artist: meta.artist || "-",
    genre: meta.genre || [],
    theme: meta.theme || [],
    status: meta.status || "Unknown",
    release_year: meta.release_year || "-",
    serialization: meta.serialization || "-",
    project: meta.project || false,
    rating: meta.rating || "-",
    description: meta.description || "",

    cover: info.cover || "/img/no-cover.jpg",
    latestChapters: info.latestChapters || [],

    populerDay:   populerMaps.day[slug]   || 0,
    populerWeek:  populerMaps.week[slug]  || 0,
    populerMonth: populerMaps.month[slug] || 0
  };
}

// ====================================================
// ANALYTICS
// ====================================================

function getPopularityByRange(populerData, range) {
  const startDate = getStartDate(range);
  const result = {};

  for (const dateStr in populerData) {
    if (startDate && new Date(dateStr) < startDate) continue;

    for (const slug in populerData[dateStr]) {
      result[slug] = (result[slug] || 0) + Number(populerData[dateStr][slug]);
    }
  }

  return result;
}

function getTotalViews(populerData, range = "all") {
  const startDate = getStartDate(range);
  let total = 0;

  for (const dateStr in populerData) {
    if (startDate && new Date(dateStr) < startDate) continue;

    for (const slug in populerData[dateStr]) {
      total += Number(populerData[dateStr][slug]) || 0;
    }
  }

  return total;
}

function getViewsTrendLastDays(populerData, days = 7) {
  const result = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    const dailyData = populerData[formatDateKey(date)] || {};
    let total = 0;

    for (const slug in dailyData) {
      total += Number(dailyData[slug]) || 0;
    }

    result.push(total);
  }

  return result;
}

function countUniqueManga(mangaList = []) {
  return new Set(mangaList.map(m => m.id.toLowerCase())).size;
}

function getStartDate(range) {
  if (range === "all") return null;

  const date = new Date();
  if (range === "day") date.setDate(date.getDate() - 1);
  if (range === "week") date.setDate(date.getDate() - 7);
  if (range === "month") date.setMonth(date.getMonth() - 1);

  return date;
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
