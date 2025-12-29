const fs = require("fs");
const path = require("path");
const { db } = require("./firebase");

function daysBetween(a, b) {
  return Math.floor((a - b) / (1000 * 60 * 60 * 24));
}

async function syncFirestoreToLocal() {
  const DATA_DIR = path.join(__dirname, "../data");

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  console.log("🔁 Syncing Firestore → local JSON...");

  // ===================================================
  // 1. MANGA INDEX → index.json (as manga_list array)
  // ===================================================
  const indexSnap = await db.collection("manga_index").get();
  const mangaList = [];

  indexSnap.forEach(doc => {
    mangaList.push({
      id: doc.id,
      ...doc.data()
    });
  });

  fs.writeFileSync(
    path.join(DATA_DIR, "index.json"),
    JSON.stringify({ manga_list: mangaList }, null, 2)
  );

  console.log("✔ Synced index.json (manga_list)");



  // ===================================================
  // 2. LATEST MANGA → latest.json
  // ===================================================
  const latestSnap = await db.collection("latest_manga").get();
  const latest = {};
  latestSnap.forEach(doc => (latest[doc.id] = doc.data()));

  fs.writeFileSync(
    path.join(DATA_DIR, "latest.json"),
    JSON.stringify(latest, null, 2)
  );
  console.log("✔ Synced latest.json");

  // ===================================================
  // 3. POPULAR DAILY → popular.json (TRANSFORM)
  // ===================================================
  const popularSnap = await db.collection("popular_daily").get();
  const popular = {};

  const today = new Date();

  popularSnap.forEach(doc => {
    const dateKey = doc.id; // YYYY-MM-DD
    const date = new Date(dateKey);
    const diff = daysBetween(today, date);
    const data = doc.data();

    for (const slug in data) {
      if (slug === "updatedAt") continue;

      if (!popular[slug]) {
        popular[slug] = { day: 0, week: 0, month: 0, total: 0 };
      }

      const count = Number(data[slug]) || 0;

      // total
      popular[slug].total += count;

      // month (30 hari)
      if (diff <= 30) popular[slug].month += count;

      // week (7 hari)
      if (diff <= 7) popular[slug].week += count;

      // day (hari ini saja)
      if (diff === 0) popular[slug].day += count;
    }
  });

  fs.writeFileSync(
    path.join(DATA_DIR, "popular.json"),
    JSON.stringify(popular, null, 2)
  );
  console.log("✔ Synced popular.json (transformed)");

  console.log("✅ Firestore sync finished");
}

module.exports = syncFirestoreToLocal;
