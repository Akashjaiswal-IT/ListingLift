import http from "node:http";
import { logger } from "@repo/logger";
import { connectToDatabase } from "@repo/database";
import { app as expressApplication } from "./server";
import { env } from "./env";

async function init() {
  try {
    const server = http.createServer(expressApplication);
    const PORT: number = env.PORT ? +env.PORT : 8000;

    server.listen(PORT, () => {
      logger.info(`ListingLift API server is running on PORT ${PORT}`);
    });

    // Connect to MongoDB asynchronously
    connectToDatabase()
      .then(() => {
        logger.info("Connected to MongoDB successfully");
      })
      .catch((err) => {
        logger.warn(
          "MongoDB connection deferred (database may be starting or offline): " +
            (err.message || String(err))
        );
      });
  } catch (err) {
    logger.error(`Error starting ListingLift server`, { err });
    process.exit(1);
  }
}

init();
