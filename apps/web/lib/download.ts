/**
 * Download a file by routing through our same-origin /api/download proxy.
 *
 * This prevents:
 * 1. Cross-Origin (CORS) blocks on cloud storage URLs
 * 2. Browsers ignoring the `download` attribute for cross-origin URLs
 * 3. Opening images in a new browser tab instead of saving to disk
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;

  try {
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      throw new Error(`Download failed with status ${res.status}`);
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
  } catch (err) {
    // Fallback: trigger same-origin download link directly.
    // The server sets Content-Disposition: attachment so browser downloads instead of navigating.
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }
}
