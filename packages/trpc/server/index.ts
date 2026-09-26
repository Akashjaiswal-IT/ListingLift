import { router } from "./trpc";

import { healthRouter } from "./routes/health/route";
import { userRouter } from "./routes/user/route";
import { uploadRouter } from "./routes/upload/route";
import { generateRouter } from "./routes/generate/route";
import { listingRouter } from "./routes/listing/route";
import { cardRouter } from "./routes/card/route";
import { downloadRouter } from "./routes/download/route";
import { creditsRouter } from "./routes/credits/route";
import { paymentsRouter } from "./routes/payments/route";
import { adminRouter } from "./routes/admin/route";

export const serverRouter = router({
  health: healthRouter,
  user: userRouter,
  upload: uploadRouter,
  generate: generateRouter,
  listing: listingRouter,
  card: cardRouter,
  download: downloadRouter,
  credits: creditsRouter,
  payments: paymentsRouter,
  admin: adminRouter,
});

export { createContext } from "./context";
export type ServerRouter = typeof serverRouter;
