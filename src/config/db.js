const mongoose = require("mongoose");
const dotenv = require("dotenv");
let isConnected = false;
dotenv.config();

const connectToDB = async () => {
  mongoose.set("strictQuery", true);

  if (!process.env.MONGODB_URI)
    return console.log("MONGODB_URI is not defined");

  if (isConnected) return console.log("=> using existing database connection");

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    isConnected = true;
    console.log("MongoDB Connected");
  } catch (error) {
    console.log(error);
  }
};

module.exports = connectToDB;
