const express = require('express');
const router = express.Router();
const HomeController = require('../controllers/HomeController');





router.get('/', HomeController.index);
router.get('/about', HomeController.about);




module.exports = router;
