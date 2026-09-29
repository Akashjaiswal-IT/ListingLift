import sharp from "sharp";

export interface ImageMetadataResult {
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
}

export async function getImageMetadata(buffer: Buffer): Promise<ImageMetadataResult> {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || "unknown",
    sizeBytes: buffer.length,
  };
}

export async function validateImageBuffer(buffer: Buffer): Promise<{
  isValid: boolean;
  error?: string;
  metadata?: ImageMetadataResult;
}> {
  try {
    const meta = await getImageMetadata(buffer);
    const allowedFormats = ["jpeg", "jpg", "png", "webp", "heic", "tiff"];
    if (!allowedFormats.includes(meta.format.toLowerCase())) {
      return {
        isValid: false,
        error: `Unsupported image format: ${meta.format}. Allowed: JPG, PNG, WEBP.`,
      };
    }

    if (meta.width < 100 || meta.height < 100) {
      return {
        isValid: false,
        error: "Image dimensions too small. Minimum 100x100 pixels.",
      };
    }

    return { isValid: true, metadata: meta };
  } catch (err: any) {
    return { isValid: false, error: err.message || "Invalid image buffer" };
  }
}

export async function generateThumbnail(
  buffer: Buffer,
  maxWidth: number = 320,
  maxHeight: number = 320
): Promise<Buffer> {
  return await sharp(buffer)
    .resize(maxWidth, maxHeight, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toBuffer();
}

export async function optimizeForAi(buffer: Buffer): Promise<Buffer> {
  return await sharp(buffer)
    .resize(1536, 1536, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
}
