import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { ListingObject, User, connectToDatabase } from "@repo/database";
import { logger } from "@repo/logger";
import { generateListingTextStream } from "@repo/services";

export const sseRouter = Router();

sseRouter.post("/:listingObjectId/text-stream", async (req: Request, res: Response) => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { listingObjectId } = req.params;
  if (!listingObjectId) {
    return res.status(400).json({ error: "listingObjectId is required" });
  }

  await connectToDatabase();

  const user = await User.findOne({ clerkId: auth.userId });
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  const listing = await ListingObject.findOne({
    _id: listingObjectId,
    userId: user._id,
  });

  if (!listing) {
    return res.status(404).json({ error: "Listing object not found" });
  }

  // Set up SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if (typeof (res as any).flush === "function") {
      (res as any).flush();
    }
  };

  try {
    sendEvent("status", { message: "Starting text generation..." });

    await ListingObject.updateOne(
      { _id: listing._id },
      { $set: { textStatus: "streaming" } }
    );

    // Stream text generation from services
    const generatedText = await generateListingTextStream(
      {
        userTitle: listing.userTitle || "Product",
        userDescription: listing.userDescription || "",
        userPrompt: listing.userPrompt,
        price: listing.price,
        discountPrice: listing.discountPrice,
        sizes: listing.sizes,
        variants: listing.variants,
        ctaText: listing.ctaText,
        storeName: user.storeName,
        whatsappNumber: user.whatsappNumber,
        instagramHandle: user.instagramHandle,
        originalImageUrls: listing.originalImages.map((img) => img.url),
      },
      (chunk) => {
        sendEvent("chunk", chunk);
      }
    );

    await ListingObject.updateOne(
      { _id: listing._id },
      {
        $set: {
          aiGeneratedText: generatedText,
          textStatus: "completed",
        },
      }
    );

    sendEvent("complete", { listingObjectId: listing._id, text: generatedText });
    res.write("event: end\ndata: {}\n\n");
    res.end();
  } catch (err: any) {
    logger.error("Error in SSE text streaming", { err, listingObjectId });
    await ListingObject.updateOne(
      { _id: listing._id },
      { $set: { textStatus: "failed", errorMessage: err.message } }
    );
    sendEvent("error", { message: err.message || "Failed to generate text" });
    res.end();
  }
});
