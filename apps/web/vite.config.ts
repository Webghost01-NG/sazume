import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  server: {
    fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] },
  },
  build: {
    outDir: fileURLToPath(new URL("../../dist", import.meta.url)),
    emptyOutDir: true,
  },
});
