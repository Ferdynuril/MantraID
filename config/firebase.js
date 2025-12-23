const { Firestore } = require("@google-cloud/firestore");

const db = new Firestore({
  projectId: "seventh-odyssey-478912-m5",
  databaseId: "mantraid",
});

module.exports = { db };
