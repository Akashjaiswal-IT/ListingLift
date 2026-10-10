import sharp from "sharp";

const MAX_SIDE = 1024; // work at this size for speed; cards render the product well below it
const BORDER_WHITE_RATIO = 0.85; // min share of border pixels that must be near-white to attempt a cutout
const MIN_REMOVED = 0.1; // sanity: removing less than this means nothing was cut
const MAX_REMOVED = 0.92; // sanity: removing more than this means the product was eaten
const SHADOW_MAX_ALPHA = 160;

// Pure white studio backdrop (#FFFFFF with a little JPEG/AI noise)
function isNearWhite(r: number, g: number, b: number): boolean {
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return min >= 235 && max - min <= 18;
}

// Neutral light-grey: the soft contact shadow under the product
function isLightGrey(r: number, g: number, b: number): boolean {
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return min >= 150 && max - min <= 18;
}

async function asPng(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input).rotate().png().toBuffer();
  } catch {
    return input;
  }
}

/**
 * Removes a pure-white studio background so the product can sit directly on a
 * dark template. Only background connected to the image border is removed
 * (white parts inside the product survive) and the soft contact shadow is kept
 * as a translucent dark shadow. Never throws: on any failure or doubt it returns
 * the original as PNG with `cutout: false`.
 */
export async function cutoutWhiteBackground(
  input: Buffer
): Promise<{ buffer: Buffer; cutout: boolean }> {
  try {
    const { data, info } = await sharp(input)
      .rotate()
      .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height } = info;
    const total = width * height;
    const rgbaAt = (p: number) => [data[p * 4]!, data[p * 4 + 1]!, data[p * 4 + 2]!] as const;

    // 1. Border check: only attempt a cutout on a (mostly) white backdrop
    const borderPixels: number[] = [];
    for (let x = 0; x < width; x++) {
      borderPixels.push(x, (height - 1) * width + x);
    }
    for (let y = 1; y < height - 1; y++) {
      borderPixels.push(y * width, y * width + width - 1);
    }
    const whiteBorder = borderPixels.filter((p) => isNearWhite(...rgbaAt(p)));
    if (whiteBorder.length / borderPixels.length < BORDER_WHITE_RATIO) {
      return { buffer: await asPng(input), cutout: false };
    }

    // 2. Flood fill (iterative) from white border pixels through background-like pixels
    const isBackground = new Uint8Array(total);
    const stack = new Int32Array(total);
    let top = 0;
    for (const p of whiteBorder) {
      isBackground[p] = 1;
      stack[top++] = p;
    }
    while (top > 0) {
      const p = stack[--top]!;
      const x = p % width;
      const neighbours = [
        x > 0 ? p - 1 : -1,
        x < width - 1 ? p + 1 : -1,
        p >= width ? p - width : -1,
        p < total - width ? p + width : -1,
      ];
      for (const n of neighbours) {
        if (n < 0 || isBackground[n]) continue;
        const [r, g, b] = rgbaAt(n);
        if (isNearWhite(r, g, b) || isLightGrey(r, g, b)) {
          isBackground[n] = 1;
          stack[top++] = n;
        }
      }
    }

    // 3. Alpha: white -> transparent, grey shadow -> soft translucent black, product -> opaque
    const alpha = new Uint8Array(total).fill(255);
    let removed = 0;
    for (let p = 0; p < total; p++) {
      if (!isBackground[p]) continue;
      const [r, g, b] = rgbaAt(p);
      if (isNearWhite(r, g, b)) {
        alpha[p] = 0;
        removed++;
      } else {
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        alpha[p] = Math.max(0, Math.min(SHADOW_MAX_ALPHA, Math.round((255 - luminance) * 1.6)));
        data[p * 4] = 0;
        data[p * 4 + 1] = 0;
        data[p * 4 + 2] = 0;
      }
    }

    // 4. Sanity check
    const removedRatio = removed / total;
    if (removedRatio < MIN_REMOVED || removedRatio > MAX_REMOVED) {
      return { buffer: await asPng(input), cutout: false };
    }

    // 5. Feather only the product boundary (inward, so no white halo appears)
    const blurred = await sharp(Buffer.from(alpha), { raw: { width, height, channels: 1 } })
      .blur(0.8)
      .extractChannel(0)
      .raw()
      .toBuffer();
    for (let p = 0; p < total; p++) {
      data[p * 4 + 3] = isBackground[p] ? alpha[p]! : blurred[p]!;
    }

    // 6. Trim transparent margins so the product fills its box when resized
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3]! > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) {
      return { buffer: await asPng(input), cutout: false };
    }

    const buffer = await sharp(data, { raw: { width, height, channels: 4 } })
      .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
      .png()
      .toBuffer();

    return { buffer, cutout: true };
  } catch (err) {
    console.warn("Background cutout failed, using original product image:", err);
    return { buffer: await asPng(input), cutout: false };
  }
}
