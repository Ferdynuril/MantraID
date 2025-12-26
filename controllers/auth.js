/**
 * Admin Controller
 * ----------------------------------------------------
 * - Authentication (login / logout)
 * - Dashboard data aggregation
 * - Manga CRUD
 * - Popular analytics (NEW FORMAT)
 */

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");

// ====================================================
// PATH CONSTANTS
// ====================================================
const DATA_DIR     = path.join(__dirname, "../data");
const ADMIN_PATH   = path.join(DATA_DIR, "admin.json");
const LATEST_PATH  = path.join(DATA_DIR, "latest.json");
const POPULER_PATH = path.join(DATA_DIR, "popular.json");
const INDEX_PATH   = path.join(DATA_DIR, "index.json");

// ====================================================
// UTILITIES
// ====================================================
function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ====================================================
// AUTH
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
    const latestData  = readJSON(LATEST_PATH);
    const populerData = readJSON(POPULER_PATH);
    const indexData   = readJSON(INDEX_PATH);

    const metaMap = buildMetaMap(indexData.manga_list || []);
    const populerMaps = buildPopularMap(populerData);

    const mangas = Object.entries(latestData).map(([slug, info]) =>
      buildMangaObject(slug, info, metaMap, populerMaps)
    );

    const totalViews = {
      day:   Object.values(populerData).reduce((a, b) => a + (b.day || 0), 0),
      week:  Object.values(populerData).reduce((a, b) => a + (b.week || 0), 0),
      month: Object.values(populerData).reduce((a, b) => a + (b.month || 0), 0),
      all:   Object.values(populerData).reduce((a, b) => a + (b.total || 0), 0)
    };

    res.render("dashboard", {
      admin: req.session.admin,
      mangas,
      totalViews,
      totalManga: Object.keys(metaMap).length
    });

  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).send("Gagal memuat dashboard");
  }
};

// ====================================================
// MANGA LIST
// ====================================================
exports.mangaList = (req, res) => {
  try {
    const latestData  = readJSON(LATEST_PATH);
    const populerData = readJSON(POPULER_PATH);
    const indexData   = readJSON(INDEX_PATH);

    const metaMap = buildMetaMap(indexData.manga_list || []);
    const populerMaps = buildPopularMap(populerData);

    const mangas = Object.entries(latestData).map(([slug, info]) =>
      buildMangaObject(slug, info, metaMap, populerMaps)
    );

    res.render("list", {
      admin: req.session.admin,
      mangas
    });

  } catch (err) {
    console.error("List error:", err);
    res.status(500).send("Gagal memuat list manga");
  }
};

// ====================================================
// CRUD MANGA
// ====================================================
exports.createManga = (req, res) => {
  try {
    const data = req.body;
    if (!data.title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const indexData  = readJSON(INDEX_PATH);
    const latestData = readJSON(LATEST_PATH);

    const slug = (data.id || data.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    if (indexData.manga_list.some(m => m.id === slug)) {
      return res.status(409).json({ error: "Manga already exists" });
    }

    indexData.manga_list.push({
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
    });

    latestData[slug] = {
      cover: "/img/no-cover.jpg",
      latestChapters: []
    };

    saveJSON(INDEX_PATH, indexData);
    saveJSON(LATEST_PATH, latestData);

    res.json({ success: true });
  } catch (err) {
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
// HELPERS
// ====================================================
function buildMetaMap(list = []) {
  const map = {};
  list.forEach(m => map[m.id] = m);
  return map;
}

function buildPopularMap(data = {}) {
  const map = { day: {}, week: {}, month: {}, total: {} };
  for (const slug in data) {
    map.day[slug]   = data[slug].day   || 0;
    map.week[slug]  = data[slug].week  || 0;
    map.month[slug] = data[slug].month || 0;
    map.total[slug] = data[slug].total || 0;
  }
  return map;
}

function buildMangaObject(slug, info, metaMap, populer) {
  const meta = metaMap[slug] || {};

  return {
    slug,
    id: meta.id || slug,
    title: meta.title || slug.replace(/-/g, " "),
    alternative_title: meta.alternative_title || "",
    author: meta.author || "",
    artist: meta.artist || "",
    genre: meta.genre || [],
    theme: meta.theme || [],
    status: meta.status || "Unknown",
    release_year: meta.release_year || "-",
    serialization: meta.serialization || "",
    project: meta.project || false,
    rating: meta.rating || "-",
    description: meta.description || "",

    cover: info.cover || "/img/no-cover.jpg",
    latestChapters: info.latestChapters || [],


    populerDay:   populer.day[slug]   || 0,
    populerWeek:  populer.week[slug]  || 0,
    populerMonth: populer.month[slug] || 0,
    populerTotal: populer.total[slug] || 0
  };
}
