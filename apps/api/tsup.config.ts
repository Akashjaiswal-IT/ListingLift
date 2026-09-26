import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./src/index.ts"],
  splitting: false,
  bundle: true,
  outDir: "./dist",
  clean: true,
  external: ["sharp", "mongoose", "bullmq", "ioredis"],
  env: { IS_SERVER_BUILD: "true" },
  loader: { ".json": "copy" },
  minify: false,
  sourcemap: false,
});
