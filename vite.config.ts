import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Standard Vite configuration for TanStack Start
export default defineConfig({
  plugins: [
    tanstackStart(),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    // Vercel expects client assets under dist/client
    outDir: "dist/client",
  },
  server: {
    port: 8080,
    host: true,
    // Allow fallback to another port if 8080 is in use
    strictPort: false,
  },
});
