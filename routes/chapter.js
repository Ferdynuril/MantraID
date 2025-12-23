const express = require("express");
const router = express.Router();
const ChapterController = require("../controllers/ChapterController");

router.get("/:manga/:chapter", ChapterController.readChapter);

module.exports = router;
