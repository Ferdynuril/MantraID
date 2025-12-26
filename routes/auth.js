const express = require("express");
const router = express.Router();
const auth = require("../controllers/auth");
const requireAdmin  = require("../middle/adminauth");
const update = require('../controllers/UpdateController');
const Blog = require("../controllers/BlogController");


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

// Blog CRUD
router.get("/blog", requireAdmin, Blog.blogList);
router.post("/blog", requireAdmin, Blog.createBlog);
router.put("/blog/:id", requireAdmin, Blog.updateBlog);
router.delete("/blog/:id", requireAdmin, Blog.deleteBlog);

module.exports = router;