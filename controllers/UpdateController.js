const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const BUCKET = 'manga-storage-1';

exports.updateAll = async (req, res) => {
  const baseUrl = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o?`;

  try {
    // 1. Ambil daftar manga
    const listUrl = baseUrl + `prefix=&delimiter=/`;
    const listResp = await fetch(listUrl);
    const listData = await listResp.json();

    if (!listData.prefixes) {
      return res.send("Tidak ada manga ditemukan.");
    }

    const mangaList = listData.prefixes;
    const result = {};

    // 2. Loop semua manga
    for (const manga of mangaList) {
      const cleanManga = manga.replace("/", "");

      const chapterUrl = baseUrl + `prefix=${manga}&delimiter=/`;
      const chapterResp = await fetch(chapterUrl);
      const chapterData = await chapterResp.json();

      if (!chapterData.prefixes) {
        console.log(`Tidak ada chapter untuk ${cleanManga}`);
        continue;
      }

      const coverUrl = `https://storage.googleapis.com/${BUCKET}/${cleanManga}/Cover.jpg`;
 



     // Ambil semua prefix chapter (sudah otomatis terurut dari lama → baru)
        const prefixes = chapterData.prefixes;

        // Ambil tiga terakhir (3 chapter terbaru)
        const latestThree = prefixes.slice(-3);

        // Array hasil chapter
        const chapters = [];

        for (const prefix of latestThree.reverse()) {
          // prefix contoh: "mangaName/12/"
          const chapterName = prefix.replace(manga, "").replace("/", "");

          // Ambil file di dalam chapter tersebut
          const contentUrl = `${baseUrl}prefix=${prefix}`;
          const contentResp = await fetch(contentUrl);
          const contentData = await contentResp.json();

          const updated = contentData?.items?.[0]?.updated || null;

          chapters.push({
            chapter: chapterName,
            updated
          });
        }

        // Simpan ke result
        result[cleanManga] = {
          latestChapters: chapters,
          cover: coverUrl
        };


      console.log(`✔ ${cleanManga} | Latest: ${chapters.chapter} | Updated: ${chapters.updated}`);
    }

    // ================================
    // 3. Sorting berdasarkan chapter terbaru
    // ================================
    const sortedResult = Object.fromEntries(
      Object.entries(result).sort((a, b) => {
        const aUpdated = new Date(a[1].latestChapters[0]?.updated || 0);
        const bUpdated = new Date(b[1].latestChapters[0]?.updated || 0);
        return bUpdated - aUpdated; // terbaru dulu
      })
    );

    // ================================
    // 4. Simpan ke server host
    // ================================
    const filePath = path.join(__dirname, "../data/latest.json");

    fs.mkdirSync(path.join(__dirname, "../data"), { recursive: true });

    fs.writeFileSync(filePath, JSON.stringify(sortedResult, null, 2));

    return res.send({
      message: "Metadata global berhasil diperbarui (LOCAL JSON)",
      saveTo: filePath,
      totalManga: Object.keys(sortedResult).length,
      data: sortedResult
    });


  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal update metadata: " + err);
  }
};
