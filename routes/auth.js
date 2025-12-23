const express = require("express");
const router = express.Router();
const auth = require("../controllers/auth");
const requireAdmin  = require("../middle/adminauth");
const update = require('../controllers/UpdateController');

// Auth
router.get("/login", auth.showLogin);
router.post("/login", auth.login);
router.get("/logout", auth.logout);

// Dashboard
router.get("/", requireAdmin, auth.dashboard);
router.get("/mangalist", requireAdmin, auth.mangaList);

// Update
router.get("/updateAll", requireAdmin, update.updateAll);

// Manga CRUD
router.post("/mangalist", requireAdmin, auth.createManga);
router.put("/mangalist/:id", requireAdmin, auth.updateManga);
router.delete("/mangalist/:id", requireAdmin, auth.deleteManga);
module.exports = router;
