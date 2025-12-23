/**
 * Manga Controller
 * =====================================================
 * - List manga + filter
 * - Detail manga & chapter
 * - Popular view counter
 * - Helper utilities
 */

const fetch = require("node-fetch");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// =====================================================
// CONSTANTS
// =====================================================

const BUCKET = "manga-storage-1";
const DATA_DIR = path.join(__dirname, "../data");

const LATEST_PATH  = path.join(DATA_DIR, "latest.json");
const INDEX_PATH   = path.join(DATA_DIR, "index.json");
const POPULER_PATH = path.join(DATA_DIR, "populer.json");

// =====================================================
// UTILITIES
// =====================================================

/** Read JSON file safely */
function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/** Format date to Indonesian locale */
function formatDate(dateString) {
  return new Date(dateString).toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

/** Human readable time ago */
function timeAgo(dateString) {
  const diff = Date.now() - new Date(dateString).getTime();

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

/** Build metadata lookup map */
function buildMetaMap(mangaList = []) {
  const map = {};
  mangaList.forEach(m => {
    map[m.id.toLowerCase()] = m;
  });
  return map;
}

// =====================================================
// LIST MANGA
// =====================================================

exports.list = async (req, res) => {
  try {
    // Load data once
    const latestData = readJSON(LATEST_PATH);
    const metaData   = readJSON(INDEX_PATH);

    const metaMap = buildMetaMap(metaData.manga_list);

    // Merge latest.json + index.json
    let mangas = Object.entries(latestData).map(([slug, info]) => {
      const meta = metaMap[slug] || {};

      return {
        slug,
        title: meta.title || slug.replace(/-/g, " "),
        cover: info.cover || meta.cover || "/img/no-cover.jpg",
        project: meta.project || false,
        genre: meta.genre || [],
        theme: meta.theme || [],
        status: meta.status || "Unknown",
        chapters: (info.latestChapters || []).map(c => ({
          chapter: c.chapter.replace("-", "."),
          url: c.chapter,
          updated: formatDate(c.updated),
          ago: timeAgo(c.updated)
        }))
      };
    });

    // ================= FILTER QUERY =================

    const tempGenre = mangas.flatMap(m => m.genre);
    const listGenre = [...new Set(tempGenre)].sort();

    const tempTheme = mangas.flatMap(m => m.theme);
    const listTheme = [...new Set(tempTheme)].sort();

    const themeCount = {};
    const genreCount = {};
    const statusCount = {
      Ongoing: 0,
      Completed: 0,
      Dropped: 0
    };

    for (const manga of mangas) {
      manga.theme.forEach(t => themeCount[t] = (themeCount[t] || 0) + 1);
      manga.genre.forEach(g => genreCount[g] = (genreCount[g] || 0) + 1);

      if (statusCount[manga.status] !== undefined) {
        statusCount[manga.status]++;
      }
    }

    const TotalTheme = listTheme.map(t => ({
      name: t,
      total: themeCount[t] || 0
    }));

    const TotalGenre = listGenre.map(g => ({
      name: g,
      total: genreCount[g] || 0
    }));

    const TotalStatus = Object.keys(statusCount).map(s => ({
      name: s,
      total: statusCount[s]
    }));


    const { genre, theme, status, project } = req.query;

    if (genre) {
      const genres = genre.split(",").map(g => g.toLowerCase());
      mangas = mangas.filter(m =>
        genres.every(g =>
          m.genre.map(x => x.toLowerCase()).includes(g)
        )
      );
    }

    if (theme) {
      const themes = theme.split(",").map(t => t.toLowerCase());
      mangas = mangas.filter(m =>
        themes.every(t =>
          m.theme.map(x => x.toLowerCase()).includes(t)
        )
      );
    }

    if (status) {
      mangas = mangas.filter(
        m => m.status.toLowerCase() === status.toLowerCase()
      );
    }

    if (project) {
      mangas = mangas.filter(
        m => String(m.project) === project
      );
    }
    const totalMangas = mangas.length;

    

    // ================= RENDER PAGE =================

    res.render("mangalist", { mangas, totalMangas, TotalGenre, TotalTheme, TotalStatus });

  } catch (err) {
    console.error("List manga error:", err);
    res.status(500).send("Gagal memuat daftar manga");
  }
};

// =====================================================
// DETAIL MANGA
// =====================================================

exports.detail = async (req, res) => {
  const manga = req.params.manga.toLowerCase();
  const prefix = `${manga}/`;

  try {
    // Fetch chapter folders
    const listUrl = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o?prefix=${prefix}&delimiter=/`;
    const folderResp = await fetch(listUrl);
    const folderData = await folderResp.json();

    const chapterFolders = (folderData.prefixes || []).map(p =>
      p.replace(prefix, "").replace("/", "")
    );

    // Load metadata
    const indexData = readJSON(INDEX_PATH);
    const info = indexData.manga_list.find(
      m => m.id.toLowerCase() === manga
    ) || null;

    const cover = `https://storage.googleapis.com/${BUCKET}/${manga}/Cover.jpg`;

    // Fetch all files once
    const allFilesUrl = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o?prefix=${manga}/`;
    const allResp = await fetch(allFilesUrl);
    const allData = await allResp.json();
    const items = allData.items || [];

    // Build chapter list with latest update
    const chapters = chapterFolders.map(ch => {
      const updatedDates = items
        .filter(i => i.name.startsWith(`${manga}/${ch}/`))
        .map(i => new Date(i.updated));

      return {
        chapter: ch.replace(/-/g, "."),
        url: ch,
        up: updatedDates.length
          ? formatDate(updatedDates.sort((a, b) => b - a)[0])
          : "Unknown"
      };
    });

    res.render("manga", { manga, chapters, info, cover });

  } catch (err) {
    console.error("Detail manga error:", err);
    res.send("Gagal mengambil data chapter");
  }
};

// =====================================================
// POPULAR COUNTER
// =====================================================

function addPopulerView(manga) {
  let data = fs.existsSync(POPULER_PATH)
    ? readJSON(POPULER_PATH)
    : {};

  const date = new Date().toISOString().slice(0, 10);

  data[date] = data[date] || {};
  data[date][manga] = (data[date][manga] || 0) + 1;

  fs.writeFileSync(POPULER_PATH, JSON.stringify(data, null, 2));
}

// =====================================================
// DETAIL CHAPTER
// =====================================================

exports.chapter = async (req, res) => {
  const { manga, chapter } = req.params;
  const mangaSlug = manga.toLowerCase();
  const baseUrl = `https://storage.googleapis.com/${BUCKET}/${mangaSlug}/${chapter}`;

  let prevUrl = null;
  let nextUrl = null;
  
  addPopulerView(mangaSlug);

  try {
    /* ================= LOAD METADATA ================= */
    const indexData = readJSON(INDEX_PATH);
    const mangaInfo = indexData.manga_list.find(
      m => m.id.toLowerCase() === mangaSlug
    );

    const title = mangaInfo?.title || mangaSlug.replace(/-/g, " ");

    /* ================= GET CHAPTER LIST ================= */
    const listUrl = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o?prefix=${mangaSlug}/&delimiter=/`;
    const folderResp = await fetch(listUrl);
    const folderData = await folderResp.json();

    const chapterFolders = (folderData.prefixes || [])
      .map(p => p.replace(`${mangaSlug}/`, "").replace("/", ""));

    const normalize = v => v.replace(/\./g, "-");

    let index = chapterFolders.indexOf(chapter);

    if (index === -1) {
      index = chapterFolders.findIndex(
        f => normalize(f) === normalize(chapter)
      );
    }

    if (index !== -1) {
      if (index > 0) {
        prevUrl = `/manga/${mangaSlug}/${chapterFolders[index - 1]}`;
      }
      if (index < chapterFolders.length - 1) {
        nextUrl = `/manga/${mangaSlug}/${chapterFolders[index + 1]}`;
      }
    }

    /* ================= LOAD IMAGES ================= */
    const images = [];
    let page = 1;

    const checkImage = async (url) => {
      try {
        const res = await axios.head(url);
        return res.status === 200;
      } catch {
        return false;
      }
    };

    while (true) {
      const pageStr = page.toString().padStart(2, "0");
      const urls = [
        `${baseUrl}/${pageStr}_out.jpg`,
        `${baseUrl}/${page}_out.jpg`
      ];

      let found = false;

      for (const url of urls) {
        if (await checkImage(url)) {
          images.push(`/image/proxy?url=${encodeURIComponent(url)}`);
          found = true;
          break;
        }
      }

      if (!found) break;
      page++;
    }

    /* ================= RENDER ================= */
    res.render("chapter", {
      title: `${title}`,
      manga: mangaSlug,
      chapter: chapter.replace(/-/g, "."),
      images,
      prevUrl,
      nextUrl
    });

  } catch (err) {
    console.error("Chapter error:", err);
    res.status(500).send("Gagal memuat chapter");
  }
};
