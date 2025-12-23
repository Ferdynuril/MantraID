const express = require('express');
const router = express.Router();
const mangaController = require('../controllers/MangaController');

// halaman daftar manga
router.get('/', mangaController.list);

// halaman detail manga + daftar chapter
router.get('/:manga', mangaController.detail);

// halaman chapter
router.get('/:manga/:chapter', mangaController.chapter);

module.exports = router;
