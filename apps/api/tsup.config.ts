import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./src/index.ts"],
  splitting: false,
  bundle: true,
  outDir: "./dist",
  clean: true,
  noExternal: [/@repo\/.*/],
  // pdfkit must stay external: it reads its font metric (.afm) files from its
  // own package directory at runtime, which breaks if bundled. Keeping it
  // external (and a direct dependency of this app) lets it load fonts from
  // node_modules normally.
  external: ["sharp", "mongoose", "bullmq", "ioredis", "pdfkit"],
  env: { IS_SERVER_BUILD: "true" },
  loader: { ".json": "copy" },
  minify: false,
  sourcemap: false,
});
