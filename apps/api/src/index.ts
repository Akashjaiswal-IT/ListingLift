import http from "node:http";
import { logger } from "@repo/logger";
import { connectToDatabase, assertTransactionsSupported, ensureDbGuards } from "@repo/database";
import { app as expressApplication } from "./server";
import { env } from "./env";

async function init() {
  try {
    const server = http.createServer(expressApplication);
    const PORT: number = env.PORT ? +env.PORT : 8000;

    server.listen(PORT, () => {
      logger.info(`Peshkar AI API server is running on PORT ${PORT}`);
    });

    // Connect to MongoDB asynchronously
    connectToDatabase()
      .then(async () => {
        logger.info("Connected to MongoDB successfully");
        // Money flows need MongoDB transactions (replica set). Refuse to run without them in production.
        try {
          await assertTransactionsSupported();
        } catch (err) {
          logger.error(String((err as Error).message));
          process.exit(1);
        }
        await ensureDbGuards();
      })
      .catch((err) => {
        logger.warn(
          "MongoDB connection deferred (database may be starting or offline): " +
            (err.message || String(err))
        );
      });
  } catch (err) {
    logger.error(`Error starting Peshkar AI server`, { err });
    process.exit(1);
  }
}

init();
