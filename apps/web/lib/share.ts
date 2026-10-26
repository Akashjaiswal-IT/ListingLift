import { toast } from "sonner";
import { copyToClipboard } from "~/lib/clipboard";
import { downloadFile } from "~/lib/download";

export interface ShareImagesOptions {
  /** Presigned image URLs (fetched through our same-origin /api/download proxy). */
  imageUrls: string[];
  /** Caption / listing text to send along. Copied to the clipboard first. */
  caption?: string;
  /** Base name for the shared files, e.g. "kurti" -> kurti-1.jpg */
  fileBaseName?: string;
  isHi: boolean;
}

async function toFile(url: string, name: string): Promise<File> {
  const res = await fetch(`/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}

export function safeFileBaseName(base: string | undefined): string {
  const cleaned = (base || "peshkar")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return cleaned || "peshkar";
}

/**
 * Share product images (+ caption) to WhatsApp, Instagram etc. through the
 * phone's native share sheet. The caption is copied first because many apps
 * (WhatsApp included) drop the text when images are shared, so the seller can
 * paste it. Where sharing files is not supported (most desktops), it downloads
 * the images and opens WhatsApp with the caption instead.
 */
export async function shareImagesWithCaption({ imageUrls, caption, fileBaseName, isHi }: ShareImagesOptions) {
  const urls = imageUrls.filter(Boolean);

  if (caption) {
    const copied = await copyToClipboard(caption);
    if (copied) {
      toast.success(isHi ? "कैप्शन कॉपी हो गया — व्हाट्सएप में पेस्ट करें" : "Caption copied — paste it in WhatsApp");
    }
  }

  const base = safeFileBaseName(fileBaseName);
  let files: File[] = [];
  const canShareFiles =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function";

  if (canShareFiles && urls.length) {
    try {
      files = await Promise.all(urls.map((u, i) => toFile(u, `${base}-${i + 1}.jpg`)));
    } catch {
      files = [];
    }
  }

  if (files.length && navigator.canShare({ files })) {
    const share = () => navigator.share({ files, text: caption || undefined });
    try {
      await share();
      return;
    } catch (err: any) {
      if (err?.name === "AbortError") return; // the seller closed the share sheet
      if (err?.name === "NotAllowedError") {
        // Preparing the photos took too long and the browser no longer treats
        // this as a tap; one more tap on the toast button opens the share sheet.
        toast(isHi ? "फ़ोटो शेयर के लिए तैयार हैं" : "Photos are ready to share", {
          action: {
            label: isHi ? "शेयर करें" : "Share",
            onClick: () => {
              share().catch(() => undefined);
            },
          },
          duration: 15000,
        });
        return;
      }
      // anything else: use the fallback below
    }
  }

  // Fallback (desktop / unsupported browsers): save the images and open
  // WhatsApp with the caption.
  for (let i = 0; i < urls.length; i++) {
    await downloadFile(urls[i]!, `${base}-${i + 1}.jpg`);
  }
  if (urls.length) {
    toast.info(isHi ? "फ़ोटो डाउनलोड हो गईं — व्हाट्सएप में अटैच करें" : "Photos downloaded — attach them in WhatsApp");
  }
  if (caption) {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(caption)}`, "_blank", "noopener");
  }
}
