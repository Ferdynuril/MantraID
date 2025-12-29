module.exports = function antiBot(req, res, next) {
  const ua = (req.headers["user-agent"] || "").toLowerCase();

  const blockedBots = [
    "claudebot",
    "gptbot",
    "google-extended",
    "bytespider",
    "facebookexternalhit",
    "ia_archiver",
    "ahrefsbot",
    "semrushbot",
    "mj12bot"
  ];

  if (blockedBots.some(bot => ua.includes(bot))) {
    console.log("🤖 Blocked bot:", ua);
    return res.status(403).send("Bots are not allowed");
  }

  next();
};
