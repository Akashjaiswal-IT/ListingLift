import imageCompression from "browser-image-compression";

/**
 * Compress/resize a photo in the browser BEFORE uploading.
 *
 * Why: phones produce 5–12 MB photos, and our users are on slow/metered Indian
 * mobile networks. The AI pipeline downsizes anyway, so sending the full-res
 * original just wastes the user's data and time. We cap the longest edge at
 * 2000px and aim for ~1.5 MB, which is plenty for studio generation.
 *
 * HEIC is passed through untouched — the compression lib can't decode it in all
 * browsers, and R2 + the worker handle the original fine. If compression fails
 * for any reason we fall back to the original file rather than blocking upload.
 */
export async function compressImage(file: File): Promise<File> {
  const isHeic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (isHeic) return file;

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 2000,
      useWebWorker: true,
      // Preserve the original type where possible (jpeg/png/webp).
      fileType: file.type || "image/jpeg",
    });
    // Keep the original filename (the lib sometimes renames).
    return new File([compressed], file.name, { type: compressed.type });
  } catch {
    return file;
  }
}

/**
 * PUT a file to a presigned URL and report upload progress.
 *
 * fetch() cannot report upload progress (no streaming request progress in
 * browsers yet), so we use XMLHttpRequest, which exposes `upload.onprogress`.
 * Resolves on a 2xx, rejects otherwise — so the caller can surface a real error
 * (unlike the old code where a failed PUT looked successful).
 */
export function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}
