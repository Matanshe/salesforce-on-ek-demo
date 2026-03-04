import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import catalogRoutes from "./src/routes/catalog.js";
import fastSearch from "./src/controllers/fast-search.js";
import { validateSignature } from "./src/middleware/validateSignature.js";
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
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Timestamp", "X-Signature", "Authorization"],
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Optional HTTP Basic Auth gate: when GATE_USER and GATE_PASSWORD are set, require them for all routes
const gateUser = process.env.GATE_USER;
const gatePassword = process.env.GATE_PASSWORD;
if (gateUser && gatePassword) {
  app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Basic ")) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Site"');
      return res.status(401).send("Authentication required");
    }
    const b64 = auth.slice(6);
    let decoded;
    try {
      decoded = Buffer.from(b64, "base64").toString("utf8");
    } catch {
      res.setHeader("WWW-Authenticate", 'Basic realm="Site"');
      return res.status(401).send("Authentication required");
    }
    const colon = decoded.indexOf(":");
    const user = colon === -1 ? decoded : decoded.slice(0, colon);
    const pass = colon === -1 ? "" : decoded.slice(colon + 1);
    if (user !== gateUser || pass !== gatePassword) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Site"');
      return res.status(401).send("Authentication required");
    }
    next();
  });
}

// Register fast-search on app so it always matches (Express 5 router can be strict)
app.get("/api/v1/fast-search", validateSignature, fastSearch);
app.use(catalogRoutes);
app.use(express.static("public"));

// SPA fallback: serve index.html for client routes (e.g. /article/:id) so direct links and refresh work
// Use a regex; Express 5 / path-to-regexp no longer accepts the "*" path.
app.get(/^(?!\/api\/).+/, (req, res, next) => {
  res.sendFile("index.html", { root: "public" }, (err) => (err ? next() : null));
});

app.listen(port, () => {
  console.log(`${getCurrentTimestamp()} - 🎬 index - Authentication server listening on port: ${port}`);
});
