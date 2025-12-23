const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { db } = require('../config/firebase');

const BUCKET = 'manga-storage-1';
const DATA_DIR = path.join(__dirname, "../data");
const LATEST_PATH = path.join(DATA_DIR, "latest.json");
const TEMP_PATH   = path.join(DATA_DIR, "latest_temp.json");

// ===================================================
// UPDATE ALL MANGA
// ===================================================

exports.updateAll = async (req, res) => {
  const baseUrl = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o?`;

  try {
    // 1. Ambil daftar manga
    const listResp = await fetch(baseUrl + `prefix=&delimiter=/`);
    const listData = await listResp.json();

    if (!listData.prefixes) return res.send("Tidak ada manga ditemukan.");

    const mangaList = listData.prefixes;
    const result = {};

    // 2. Loop semua manga
    for (const manga of mangaList) {
      const cleanManga = manga.replace("/", "");
      const chapterResp = await fetch(baseUrl + `prefix=${manga}&delimiter=/`);
      const chapterData = await chapterResp.json();
      if (!chapterData.prefixes) continue;

      const coverUrl = `https://storage.googleapis.com/${BUCKET}/${cleanManga}/Cover.jpg`;
      const prefixes = chapterData.prefixes;
      const latestThree = prefixes.slice(-3);
      const chapters = [];

      for (const prefix of latestThree.reverse()) {
        const chapterName = prefix.replace(manga, "").replace("/", "");
        const contentResp = await fetch(`${baseUrl}prefix=${prefix}`);
        const contentData = await contentResp.json();
        const updated = contentData?.items?.[0]?.updated || null;

        chapters.push({ chapter: chapterName, updated });
      }

      result[cleanManga] = { latestChapters: chapters, cover: coverUrl };
    }

    // 3. Sorting
    const sortedResult = Object.fromEntries(
      Object.entries(result).sort((a, b) => {
        const aUpdated = new Date(a[1].latestChapters[0]?.updated || 0);
        const bUpdated = new Date(b[1].latestChapters[0]?.updated || 0);
        return bUpdated - aUpdated;
      })
    );

    // 4. Simpan ke latest.json lokal
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(LATEST_PATH, JSON.stringify(sortedResult, null, 2));

    // 5. Update buffer dan flush jika ada perubahan
    await bufferLatestForFirestore(sortedResult);

    return res.send({
      message: "Metadata global berhasil diperbarui (LOCAL + Firestore buffered)",
      saveTo: LATEST_PATH,
      totalManga: Object.keys(sortedResult).length
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal update metadata: " + err);
  }
};

// ===================================================
// BUFFER + FLUSH TO FIRESTORE
// ===================================================

async function bufferLatestForFirestore(newData) {
  let buffer = {};

  if (fs.existsSync(TEMP_PATH)) {
    buffer = JSON.parse(fs.readFileSync(TEMP_PATH, "utf8"));
  }

  // Cek perubahan
  const changed = {};
  for (const [slug, meta] of Object.entries(newData)) {
    const oldJSON = JSON.stringify(buffer[slug] || {});
    const newJSON = JSON.stringify(meta);
    if (oldJSON !== newJSON) changed[slug] = meta;
  }

  if (!Object.keys(changed).length) {
    console.log("No new changes detected. Firestore flush skipped.");
    return;
  }

  // Update buffer
  fs.writeFileSync(TEMP_PATH, JSON.stringify(newData, null, 2));

  // Flush ke Firestore (batch)
  const batch = db.batch();
  const collection = db.collection('latest_manga');

  for (const [slug, meta] of Object.entries(changed)) {
    const docRef = collection.doc(slug);
    batch.set(docRef, meta, { merge: true });
  }

  await batch.commit();
  console.log(`✅ Latest metadata flushed to Firestore (${Object.keys(changed).length} manga updated)`);
}
