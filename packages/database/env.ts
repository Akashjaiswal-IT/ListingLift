import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().default("mongodb://root:password@localhost:27017/listinglift?authSource=admin"),
});

export const env = envSchema.parse({
  MONGODB_URI: process.env.MONGODB_URI,
});
