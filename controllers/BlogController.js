/**
 * Blog Controller
 * ----------------------------------------------------
 * - Blog CRUD (Admin)
 * - JSON based storage
 */

const fs = require("fs");
const path = require("path");

// ====================================================
// PATH
// ====================================================
const DATA_DIR  = path.join(__dirname, "../data");
const BLOG_PATH = path.join(DATA_DIR, "blog.json");

// ====================================================
// UTIL
// ====================================================
function readJSON(file) {
  if (!fs.existsSync(file)) return { blogs: [] };
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function saveJSON(file, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ====================================================
// LIST BLOG
// ====================================================
exports.blogList = (req, res) => {
  try {
    const data = readJSON(BLOG_PATH);

    res.render("adminblog", {
      admin: req.session.admin,
      blogs: data.blogs || []
    });
  } catch (err) {
    console.error("Blog list error:", err);
    res.status(500).send("Gagal memuat blog");
  }
};

// ====================================================
// CREATE BLOG
// ====================================================
exports.createBlog = (req, res) => {
  try {
    const { id, title } = req.body;
    if (!id || !title) {
      return res.status(400).json({ error: "ID & title required" });
    }

    const data = readJSON(BLOG_PATH);

    if (data.blogs.some(b => b.id === id)) {
      return res.status(409).json({ error: "Blog already exists" });
    }

    data.blogs.push({
      id,
      title,
      author: req.body.author || "Admin",
      tags: req.body.tags || [],
      status: req.body.status || "Draft",
      content: req.body.content || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    saveJSON(BLOG_PATH, data);
    res.json({ success: true });
  } catch (err) {
    console.error("Create blog error:", err);
    res.status(500).json({ error: "Create blog failed" });
  }
};

// ====================================================
// UPDATE BLOG
// ====================================================
exports.updateBlog = (req, res) => {
  try {
    const { id } = req.params;
    const data = readJSON(BLOG_PATH);

    const blog = data.blogs.find(b => b.id === id);
    if (!blog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    Object.assign(blog, req.body, {
      updatedAt: new Date().toISOString()
    });

    saveJSON(BLOG_PATH, data);
    res.json({ success: true });
  } catch (err) {
    console.error("Update blog error:", err);
    res.status(500).json({ error: "Update blog failed" });
  }
};

// ====================================================
// DELETE BLOG
// ====================================================
exports.deleteBlog = (req, res) => {
  try {
    const { id } = req.params;
    const data = readJSON(BLOG_PATH);

    data.blogs = data.blogs.filter(b => b.id !== id);

    saveJSON(BLOG_PATH, data);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete blog error:", err);
    res.status(500).json({ error: "Delete blog failed" });
  }
};
