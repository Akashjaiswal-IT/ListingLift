import { create } from "zustand";

export interface StreamedListingText {
  seoTitle?: string;
  seoDescription?: string;
  keyFeatures?: string[];
  keywords?: string[];
  meeshoListing?: {
    title?: string;
    description?: string;
    category?: string;
    subcategory?: string;
  };
  whatsappCaption?: string;
  instagramCaption?: string;
  instagramHashtags?: string[];
}

interface GenerationStore {
  currentListingId: string | null;
  status: "uploaded" | "queued" | "processing" | "completed" | "failed";
  textStatus: "pending" | "streaming" | "completed" | "failed";
  streamedText: StreamedListingText | null;
  rawTextStream: string;
  isPolling: boolean;
  setCurrentListingId: (id: string | null) => void;
  setStatus: (status: GenerationStore["status"]) => void;
  setTextStatus: (textStatus: GenerationStore["textStatus"]) => void;
  setStreamedText: (text: StreamedListingText | null) => void;
  appendRawText: (chunk: string) => void;
  setIsPolling: (isPolling: boolean) => void;
  reset: () => void;
}

export const useGenerationStore = create<GenerationStore>((set) => ({
  currentListingId: null,
  status: "uploaded",
  textStatus: "pending",
  streamedText: null,
  rawTextStream: "",
  isPolling: false,
  setCurrentListingId: (currentListingId) => set({ currentListingId }),
  setStatus: (status) => set({ status }),
  setTextStatus: (textStatus) => set({ textStatus }),
  setStreamedText: (streamedText) => set({ streamedText }),
  appendRawText: (chunk) =>
    set((state) => ({ rawTextStream: state.rawTextStream + chunk })),
  setIsPolling: (isPolling) => set({ isPolling }),
  reset: () =>
    set({
      currentListingId: null,
      status: "uploaded",
      textStatus: "pending",
      streamedText: null,
      rawTextStream: "",
      isPolling: false,
    }),
}));
