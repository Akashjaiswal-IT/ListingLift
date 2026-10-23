/**
 * Renders the template picker thumbnails in apps/web/public/card-previews/<id>.jpg.
 * Re-run after changing card designs:
 *   apps/worker/node_modules/.bin/tsx packages/services/scripts/render-card-previews.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { CARD_TEMPLATES, renderSocialCards } from "../card/card-renderer.service";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const SAMPLE_IMAGE = path.join(REPO_ROOT, "apps/web/public/hero/studio-white.webp");
const OUT_DIR = path.join(REPO_ROOT, "apps/web/public/card-previews");

async function main() {
  const productImage = await readFile(SAMPLE_IMAGE);
  await mkdir(OUT_DIR, { recursive: true });

  for (const template of CARD_TEMPLATES) {
    const { whatsappCard } = await renderSocialCards({
      productImage,
      productTitle: "Teal School Backpack",
      price: 1499,
      discountPrice: 899,
      templateId: template.id,
      language: "en",
      sellerInfo: { storeName: "Sharma Bags", whatsappNumber: "9876543210" },
      trustBadges: { cod: true, freeDelivery: true },
    });
    const preview = await sharp(whatsappCard).resize(480, 480).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    await writeFile(path.join(OUT_DIR, `${template.id}.jpg`), preview);
    console.log(`${template.id}.jpg  ${(preview.length / 1024).toFixed(0)} KB`);
  }
  console.log(`Wrote ${CARD_TEMPLATES.length} previews to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
