// src/server.js

const app = require("./app");
const port = process.env.PORT || 5000;

// Khởi động server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
