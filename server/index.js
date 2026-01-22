import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import catalogRoutes from "./src/routes/catalog.js";
import { getCurrentTimestamp } from "./src/utils/loggingUtil.js";

const app = express();
const port = process.env.APP_PORT || process.env.PORT || 3000;

// CORS for local development
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(catalogRoutes);
app.use(express.static("public"));

app.listen(port, () => {
  console.log(`${getCurrentTimestamp()} - 🎬 index - Authentication server listening on port: ${port}`);
});
