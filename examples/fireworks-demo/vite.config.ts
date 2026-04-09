import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3033,
    proxy: {
      "/api": "http://localhost:3032",
    },
  },
});
