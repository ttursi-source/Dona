/// <reference types="vitest/config" />
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
            {
              name: "router",
              test: /[\\/]node_modules[\\/](react-router|react-router-dom)[\\/]/,
            },
            {
              name: "gsap",
              test: /[\\/]node_modules[\\/](gsap|@gsap)[\\/]/,
            },
            {
              name: "icons",
              test: /[\\/]node_modules[\\/](lucide-react|@hugeicons)[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
    globals: false,
  },
});
