import dotenv from "dotenv";
dotenv.config({
  path: "./.env",
});
import app from "./app.js";

import connectDB from "./db/dbConnection.js";


const PORT = process.env.PORT || 3000;

async function startServer() {
  await connectDB();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
  });
}
startServer();