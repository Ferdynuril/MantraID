const express = require("express");
const app = express();
const port = process.env.PORT || 8080;
const path = require("path");

const session = require("express-session");

const syncFirestoreToLocal = require("./config/loadFirestore");
const generateSitemap = require("./config/generateSitemap"); // 🗺️ TAMBAHAN
const antiBot = require("./middle/antiBot");

// ================= SESSION =================
app.use(session({
  name: "mantraid.sid",
  secret: "mantraid-super-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 // 1 jam
  }
}));

// ================= STATIC =================
// ⚠️ sitemap.xml di-serve langsung dari public (AMAN SEO)
app.use(express.static(path.join(__dirname, "public")));

// ================= VIEW ENGINE =================
app.set("view engine", "ejs");
app.set("views", "./views");

// ================= BODY PARSER =================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ================= ANTI BOT =================
// ⚠️ setelah static → bot bisa ambil sitemap & assets
app.use(antiBot);

// ================= GLOBAL LOCALS =================
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.admin = req.session.admin || null;
  next();
});

// ================= ROUTES =================
const homeRoutes = require("./routes/home");
const imageRoutes = require("./routes/image");
const mangaRoutes = require("./routes/manga");
const authRoutes = require("./routes/auth");

app.use("/admin", authRoutes);
app.use("/", homeRoutes);
app.use("/image", imageRoutes);
app.use("/Manga", mangaRoutes);

// ================= 404 =================
app.use((req, res) => {
  res.status(404).render("404", {
    title: "Page Not Found",
    message: "The page you are looking for does not exist."
  });
});

// ================= ERROR =================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("error", {
    title: "Server Error",
    message: "Something went wrong!"
  });
});

// ===================================================
// START SERVER (INIT TASKS)
// ===================================================
(async () => {
  try {
    console.log("🔄 Syncing Firestore to local JSON...");
    await syncFirestoreToLocal();
    console.log("✅ Firestore sync completed");

    console.log("🗺 Generating sitemap.xml...");
    await generateSitemap();
    console.log("✅ Sitemap generated");

  } catch (e) {
    console.error("❌ Startup error:", e);
  }

  app.listen(port, () => {
    console.log(`🚀 Server running at port ${port}`);
    console.log(`🌍 https://mantraid.my.id`);
    console.log(`🗺 Sitemap: /sitemap.xml`);
  });
})();
