import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./src/index.ts"],
  splitting: false,
  bundle: true,
  outDir: "./dist",
  clean: true,
  noExternal: [/@repo\/.*/],
  // pdfkit must stay external (as in apps/api): @repo/services pulls it in for receipts, and when
  // bundled its top-level `new URL("./data/...icc", import.meta.url)` throws, crashing the worker on boot.
  external: ["sharp", "mongoose", "bullmq", "ioredis", "dotenv", "pdfkit"],
  loader: { ".json": "copy" },
  minify: false,
  sourcemap: false,
});
