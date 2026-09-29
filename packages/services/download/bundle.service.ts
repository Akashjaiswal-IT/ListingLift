import * as archiver from "archiver";
import { Writable } from "stream";
import { fetchBufferFromR2, uploadBufferToR2, getPresignedDownloadUrl } from "../storage/r2.service";
import { IListingObject } from "@repo/database";

function getZipArchiveInstance() {
  const mod: any = archiver;
  if (mod.ZipArchive) {
    return new mod.ZipArchive({ zlib: { level: 9 } });
  }
  const archiverFn: any = mod.default || mod;
  if (typeof archiverFn === "function") {
    return archiverFn("zip", { zlib: { level: 9 } });
  }
  if (mod.Archiver) {
    return new mod.Archiver("zip", { zlib: { level: 9 } });
  }
  throw new Error("Unable to instantiate zip archive");
}

export async function createListingBundleZip(
  listing: IListingObject
): Promise<{ downloadUrl: string; s3Key: string }> {
  const archive = getZipArchiveInstance();
  const buffers: Buffer[] = [];

  const streamCollector = new Writable({
    write(chunk, _encoding, callback) {
      buffers.push(chunk);
      callback();
    },
  });

  archive.pipe(streamCollector);

  // 1. Add active generated studio photos
  const activeImages = listing.generatedImages.filter((img) => img.isLatest !== false);
  for (let i = 0; i < activeImages.length; i++) {
    const img = activeImages[i]!;
    try {
      const buffer = await fetchBufferFromR2(img.s3Key);
      archive.append(buffer, {
        name: `studio-photos/studio-photo-${i + 1}-${img.variationType}.webp`,
      });
    } catch (e) {
      console.warn(`Failed to include image in zip: ${img.s3Key}`, e);
    }
  }

  // 2. Add social media cards
  if (listing.whatsappCard?.s3Key) {
    try {
      const waBuf = await fetchBufferFromR2(listing.whatsappCard.s3Key);
      archive.append(waBuf, { name: "social-cards/whatsapp-card.webp" });
    } catch {}
  }

  if (listing.instagramPost?.s3Key) {
    try {
      const igPostBuf = await fetchBufferFromR2(listing.instagramPost.s3Key);
      archive.append(igPostBuf, { name: "social-cards/instagram-post-1x1.webp" });
    } catch {}
  }

  if (listing.instagramStory?.s3Key) {
    try {
      const igStoryBuf = await fetchBufferFromR2(listing.instagramStory.s3Key);
      archive.append(igStoryBuf, { name: "social-cards/instagram-story-9x16.webp" });
    } catch {}
  }

  // 3. Add text deliverable as markdown
  if (listing.aiGeneratedText) {
    const t = listing.aiGeneratedText;
    const textMarkdown = `# ${t.seoTitle}

## SEO Description
${t.seoDescription}

## Key Features
${t.keyFeatures?.map((f) => `- ${f}`).join("\n")}

## Keywords
${t.keywords?.join(", ")}

---

## Marketplace Catalog Listing
**Title:** ${t.meeshoListing?.title || t.seoTitle}
**Category:** ${t.meeshoListing?.category || "N/A"} > ${t.meeshoListing?.subcategory || "N/A"}

**Description:**
${t.meeshoListing?.description || t.seoDescription}

---

## WhatsApp Broadcast Caption
${t.whatsappCaption}

---

## Instagram Caption
${t.instagramCaption}

**Hashtags:**
${t.instagramHashtags?.join(" ")}
`;
    archive.append(Buffer.from(textMarkdown, "utf8"), {
      name: "listing-copy/product-listing-copy.md",
    });
  }

  await archive.finalize();

  const zipBuffer = Buffer.concat(buffers);
  const zipS3Key = `bundles/${listing._id}/listing-kit-${listing._id}.zip`;

  await uploadBufferToR2(zipS3Key, zipBuffer, "application/zip");
  const downloadUrl = await getPresignedDownloadUrl(zipS3Key, 3600);

  return {
    downloadUrl,
    s3Key: zipS3Key,
  };
}

export async function createRawZipBuffer(
  files: { fileName: string; buffer: Buffer }[]
): Promise<Buffer> {
  const archive = getZipArchiveInstance();
  const buffers: Buffer[] = [];

  const streamCollector = new Writable({
    write(chunk, _encoding, callback) {
      buffers.push(chunk);
      callback();
    },
  });

  archive.pipe(streamCollector);

  for (const file of files) {
    archive.append(file.buffer, { name: file.fileName });
  }

  await archive.finalize();
  return Buffer.concat(buffers);
}

