const express = require('express');
const router = express.Router();
const axios = require('axios');

router.get('/proxy', async (req, res) => {
  const imageUrl = req.query.url;

  if (!imageUrl) {
    return res.status(400).send("URL gambar tidak ada");
  }

  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer'
    });

    res.set('Content-Type', response.headers['content-type']);
    res.send(response.data);

  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal mengambil gambar");
  }
});

module.exports = router;
