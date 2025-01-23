require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const app = express();
const cors = require("cors");
const connectToDB = require("./config/db");
const usersRouter = require("./routes/user");
const postsRoutes = require("./routes/post");
const commentsRoutes = require("./routes/comment");
const storyRoutes = require("./routes/story");
const messageRoutes = require('./routes/message')
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

connectToDB();

app.use("/api", usersRouter);
app.use("/api", postsRoutes);
app.use("/api", commentsRoutes);
app.use("/api", storyRoutes);
app.use("/api", messageRoutes);

app.use("/", async (req, res) => {
  return res.status(200).json({
    title: "Socials API ",
    author: "Gnoudev",
  });
});
module.exports = app;
