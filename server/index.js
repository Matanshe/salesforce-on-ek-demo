import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import catalogRoutes from "./src/routes/catalog.js";
import { getCurrentTimestamp } from "./src/utils/loggingUtil.js";

const app = express();
const port = process.env.APP_PORT || process.env.PORT || 3000;

// CORS: allow local dev (Vite) and production (same host or configured origin)
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
const allowedOrigins = corsOrigin.split(",").map((o) => o.trim());
app.use(
  cors({
    origin: (origin, cb) => {
      // Same-origin (no Origin header) or allowed list
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      // Allow *.herokuapp.com in production
      if (origin.endsWith(".herokuapp.com") && /^https:/.test(origin)) return cb(null, true);
      cb(null, false);
    },
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
