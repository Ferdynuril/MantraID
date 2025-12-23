const axios = require("axios");

exports.proxy = async (req, res) => {
  const url = req.query.url;

  if (!url) return res.status(400).send("Missing URL");

  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      validateStatus: () => true  // <- penting!
    });

    if (response.status === 404) {
      return res.status(404).send("Not Found");
    }

    // teruskan content-type asli
    res.set("Content-Type", response.headers["content-type"]);

    res.send(response.data);

  } catch (err) {
    res.status(500).send("Proxy Error");
  }
};
