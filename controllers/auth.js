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
const { db } = require("../config/firebase");


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
exports.createManga = async (req, res) => {
  try {
    const data = req.body;

    const slug = (data.id || data.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const ref = db.collection("manga_index").doc(slug);
    if ((await ref.get()).exists) {
      return res.status(409).json({ error: "Manga already exists" });
    }

    const mangaMeta = {
      id: slug,
      title: data.title,
      alternative_title: data.alternative_title || "",
      author: data.author || "",
      artist: data.artist || "",
      genre: Array.isArray(data.genre) ? data.genre : [],
      theme: Array.isArray(data.theme) ? data.theme : [],
      status: data.status || "Ongoing",
      release_year: Number(data.release_year) || new Date().getFullYear(),
      serialization: data.serialization || "",
      project: Boolean(data.project),
      rating: data.rating || "",
      description: data.description || "",
      post: "Ferdynuril",
      createdAt: new Date().toISOString()
    };

    await ref.set(mangaMeta);

    await db.collection("manga_latest").doc(slug).set({
      cover: "/img/no-cover.jpg",
      latestChapters: []
    });

    // update JSON lokal
    const indexData = readJSON(INDEX_PATH);
    const latestData = readJSON(LATEST_PATH);

    indexData.manga_list.push(mangaMeta);
    latestData[slug] = { cover: "/img/no-cover.jpg", latestChapters: [] };

    saveJSON(INDEX_PATH, indexData);
    saveJSON(LATEST_PATH, latestData);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Create manga failed" });
  }
};


exports.updateManga = async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const ref = db.collection("manga_index").doc(id);
  if (!(await ref.get()).exists) {
    return res.status(404).json({ error: "Manga not found" });
  }

  await ref.update(data);

  const indexData = readJSON(INDEX_PATH);
  const manga = indexData.manga_list.find(m => m.id === id);
  Object.assign(manga, data);

  saveJSON(INDEX_PATH, indexData);

  res.json({ success: true });
};


exports.deleteManga = async (req, res) => {
  const { id } = req.params;

  await Promise.all([
    db.collection("manga_index").doc(id).delete(),
    db.collection("manga_latest").doc(id).delete(),
    db.collection("manga_popular").doc(id).delete()
  ]);

  const indexData = readJSON(INDEX_PATH);
  const latestData = readJSON(LATEST_PATH);
  const populerData = readJSON(POPULER_PATH);

  indexData.manga_list = indexData.manga_list.filter(m => m.id !== id);
  delete latestData[id];
  delete populerData[id];

  saveJSON(INDEX_PATH, indexData);
  saveJSON(LATEST_PATH, latestData);
  saveJSON(POPULER_PATH, populerData);

  res.json({ success: true });
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
