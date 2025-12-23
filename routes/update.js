const express = require('express');
const router = express.Router();
const update = require('../controllers/UpdateController');

router.get("/updateAll", update.updateAll);

module.exports = router;