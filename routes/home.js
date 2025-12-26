const express = require('express');
const router = express.Router();
const HomeController = require('../controllers/HomeController');





router.get('/', HomeController.index);
router.get('/blog/:id', HomeController.blogDetail);




module.exports = router;
