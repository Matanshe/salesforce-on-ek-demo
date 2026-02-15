import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

// Fail production builds if VITE_API_SECRET is missing (prevents deploying a broken client)
if (process.env.NODE_ENV === "production" && !process.env.VITE_API_SECRET) {
  throw new Error(
    "VITE_API_SECRET is required for production builds. " +
      "Use: npm run build-client:heroku -- <your-heroku-app-name> (from repo root)"
  );
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
