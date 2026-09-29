import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { connectToDatabase, User, ListingObject, Payment } from "@repo/database";
import {
  deductCredits,
  refundCredits,
  generateStudioImages,
  reEditStudioImage,
  renderSocialCards,
  createRawZipBuffer,
  checkRateLimit,
} from "@repo/services";
import sharp from "sharp";

async function runE2ETests() {
  console.log("==================================================");
  console.log("  Peshkar AI Master Plan E2E Verification Suite   ");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, extra?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName} ${extra ? `(${extra})` : ""}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${extra ? `(${extra})` : ""}`);
      failed++;
    }
  }

  // 1. Database Connection
  console.log("\n--- Testing Phase 0: MongoDB & Schema ---");
  await connectToDatabase();
  assert(true, "MongoDB Connection established");

  const testClerkId = `test_clerk_${Date.now()}`;
  const testUser = await User.create({
    clerkId: testClerkId,
    fullName: "Priya Sharma (Test Reseller)",
    email: `test_${Date.now()}@peshkar.ai`,
    creditBalance: 10,
    lifetimeCreditsEarned: 10,
    lifetimeCreditsSpent: 0,
    storeName: "Priya Ethnic Boutique",
    whatsappNumber: "+919876543210",
    instagramHandle: "@priya_boutique",
    role: "user",
    creditHistory: [
      {
        type: "TRIAL",
        amount: 10,
        balanceAfter: 10,
        description: "Welcome trial pack",
        createdAt: new Date(),
      },
    ],
  });

  assert(!!testUser._id, "User document created with trial credits", `Balance: ${testUser.creditBalance}`);

  // 2. Credit Integrity & Atomic Deductions
  console.log("\n--- Testing Phase 1: Credits & Atomic Guard ---");
  const deductResult = await deductCredits({
    userId: testUser._id,
    amount: 2,
    description: "Quick generation charge",
    referenceId: "test_listing_1",
    referenceType: "listing_object",
  });
  assert(deductResult.newBalance === 8, "Atomic credit deduction", `Balance after: ${deductResult.newBalance}`);

  // Test overdraw protection
  let overdrawBlocked = false;
  try {
    await deductCredits({
      userId: testUser._id,
      amount: 50, // More than 8
      description: "Should fail",
    });
  } catch {
    overdrawBlocked = true;
  }
  assert(overdrawBlocked, "Atomic credit guard blocks overdrawing negative balance");

  // Refund
  const refundResult = await refundCredits({
    userId: testUser._id,
    amount: 2,
    description: "Failed generation refund",
  });
  assert(refundResult.newBalance === 10, "Atomic credit refund works", `Restored balance: ${refundResult.newBalance}`);

  // 3. AI Studio Image Generation & InteractionId
  console.log("\n--- Testing Phase 2: Studio Generation & InteractionId ---");
  // Create sample 800x800 test product image
  const sampleProductBuffer = await sharp({
    create: {
      width: 800,
      height: 800,
      channels: 4,
      background: { r: 180, g: 70, b: 90, alpha: 1 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="800" height="800"><text x="400" y="400" font-size="48" fill="#fff" text-anchor="middle" font-family="sans-serif">Sample Kurti</text></svg>`
        ),
      },
    ])
    .png()
    .toBuffer();

  const generatedOutputs = await generateStudioImages({
    originalImages: [sampleProductBuffer],
    prompt: "Premium Indian festive silk kurti on studio pedestal",
    count: 2,
  });

  assert(generatedOutputs.length === 2, "Generated 2 studio images");
  assert(!!generatedOutputs[0]?.interactionId, "First image contains interactionId", generatedOutputs[0]?.interactionId);
  assert(!!generatedOutputs[1]?.interactionId, "Second image contains interactionId", generatedOutputs[1]?.interactionId);

  // 4. Re-edit with interactionId continuity
  console.log("\n--- Testing Phase 3: Multi-turn Re-edit ---");
  const reEditedOutput = await reEditStudioImage({
    originalImages: [sampleProductBuffer],
    previousImage: generatedOutputs[0]!.buffer,
    interactionId: generatedOutputs[0]!.interactionId,
    newPrompt: "Change background to warm peach marble with festive flowers",
  });

  assert(!!reEditedOutput.buffer, "Re-edited image generated");
  assert(!!reEditedOutput.interactionId, "Re-edited image preserves/updates interactionId", reEditedOutput.interactionId);

  // 5. Card Renderer
  console.log("\n--- Testing Phase 3: Social Marketing Card Rendering ---");
  const cards = await renderSocialCards({
    productImage: generatedOutputs[0]!.buffer,
    productTitle: "Embroidered Silk Anarkali Kurti",
    price: 1299,
    discountPrice: 899,
    storeName: "Priya Ethnic Boutique",
    whatsappNumber: "+919876543210",
    instagramHandle: "@priya_boutique",
    ctaText: "Order via WhatsApp",
  });

  // Verify card dimensions
  const whatsappMeta = await sharp(cards.whatsapp).metadata();
  const igPostMeta = await sharp(cards.instagramPost).metadata();
  const igStoryMeta = await sharp(cards.instagramStory).metadata();

  assert(whatsappMeta.width === 1080 && whatsappMeta.height === 1080, "WhatsApp card is 1080x1080");
  assert(igPostMeta.width === 1080 && igPostMeta.height === 1080, "Instagram Post card is 1080x1080");
  assert(igStoryMeta.width === 1080 && igStoryMeta.height === 1920, "Instagram Story card is 1080x1920");

  // 6. Download Bundle (ZIP)
  console.log("\n--- Testing Phase 3: ZIP Bundle Generator ---");
  const zipBuffer = await createRawZipBuffer([
    { fileName: "studio_shot_1.webp", buffer: generatedOutputs[0]!.buffer },
    { fileName: "studio_shot_2.webp", buffer: generatedOutputs[1]!.buffer },
    { fileName: "cards/whatsapp_card.webp", buffer: cards.whatsappCard },
    { fileName: "cards/instagram_post.webp", buffer: cards.instagramPost },
    { fileName: "cards/instagram_story.webp", buffer: cards.instagramStory },
  ]);

  assert(zipBuffer.length > 5000, "ZIP bundle created successfully", `Size: ${(zipBuffer.length / 1024).toFixed(1)} KB`);

  // 7. Rate Limiter
  console.log("\n--- Testing Phase 6: Rate Limiting ---");
  const limitCheck1 = await checkRateLimit(String(testUser._id), "generate");
  assert(limitCheck1.allowed, "First rate limit check passes", `Remaining: ${limitCheck1.remaining}`);

  // 8. Cleanup test data
  console.log("\n--- Cleanup ---");
  await User.deleteOne({ _id: testUser._id });
  console.log("Cleaned up test user.");

  console.log("\n==================================================");
  console.log(`  E2E Test Results: ${passed} PASSED, ${failed} FAILED  `);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runE2ETests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
