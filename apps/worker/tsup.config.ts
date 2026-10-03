import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./src/index.ts"],
  splitting: false,
  bundle: true,
  outDir: "./dist",
  clean: true,
  noExternal: [/@repo\/.*/],
  external: ["sharp", "mongoose", "bullmq", "ioredis", "dotenv"],
  loader: { ".json": "copy" },
  minify: false,
  sourcemap: false,
});
