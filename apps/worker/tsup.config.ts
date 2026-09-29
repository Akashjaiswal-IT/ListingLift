import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./src/index.ts"],
  splitting: false,
  bundle: true,
  outDir: "./dist",
  clean: true,
  external: ["sharp", "mongoose", "bullmq", "ioredis", "dotenv"],
  loader: { ".json": "copy" },
  minify: false,
  sourcemap: false,
});
