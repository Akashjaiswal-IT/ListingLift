import mongoose, { Schema, Document, Types, Model } from "mongoose";

// --- Sub-document interfaces ---

export interface IOriginalImage {
  s3Key: string;
  fileName: string;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  fileSizeBytes?: number;
  mimeType?: string;
}

export interface IGeneratedImage {
  _id: Types.ObjectId;       // Mongoose auto-generates, needed for re-edit targeting
  s3Key: string;
  url: string;
  thumbnailUrl?: string;
  variationType: string;     // "studio_white" | "studio_premium" | "lifestyle" | "custom"
  promptUsed: string;        // the enhanced prompt that generated this
  interactionId: string;     // Gemini/Nano Banana conversation session ID for multi-turn editing
  isLatest: boolean;         // true = currently shown; false = hidden history
  replacedBy?: Types.ObjectId; // points to the newer version if re-edited
  createdAt: Date;
}

export interface IAiGeneratedText {
  seoTitle: string;
  seoDescription: string;
  keyFeatures: string[];
  keywords: string[];
  meeshoListing: {
    title: string;
    description: string;
    category?: string;
    subcategory?: string;
  };
  whatsappCaption: string;
  instagramCaption: string;
  instagramHashtags: string[];
}

export interface ISocialCard {
  s3Key: string;
  url: string;
  templateId?: string;
  generatedAt: Date;
}

// --- Main document ---

export interface IListingObject extends Document {
  userId: Types.ObjectId;
  type: "listing_product" | "listing_kit";

  // Status tracking
  status: "uploaded" | "queued" | "processing" | "completed" | "failed";
  textStatus: "pending" | "streaming" | "completed" | "failed";

  // Step 1: Upload
  originalImages: IOriginalImage[];

  // Step 2: User input (all collected upfront)
  userTitle: string;
  userDescription?: string;
  userPrompt?: string;       // custom prompt for image gen: "premium studio", "pink bg"
  price?: number;            // in rupees
  discountPrice?: number;    // sale price
  sizes?: string[];          // ["S", "M", "L", "XL"]
  variants?: string[];       // ["Red", "Blue"]
  ctaText?: string;          // "Order Now via WhatsApp"

  // Step 3: AI-generated text (streamed via SSE, persisted)
  aiGeneratedText?: IAiGeneratedText;

  // Step 4: Generated images (via BullMQ worker, persisted)
  generatedImages: IGeneratedImage[];

  // Cards (generated after image gen completes, in same BullMQ job)
  whatsappCard?: ISocialCard;
  instagramPost?: ISocialCard;    // 1:1
  instagramStory?: ISocialCard;   // 9:16

  // LLM prompt enhancement
  enhancedPrompt?: string;        // the prompt OpenAI Vision generated for Gemini

  // Credit tracking
  creditsCharged: number;
  creditsRefunded: boolean;

  // Job tracking
  bullmqJobId?: string;
  errorMessage?: string;
  retryCount: number;

  createdAt: Date;
  updatedAt: Date;
}

const OriginalImageSchema = new Schema<IOriginalImage>(
  {
    s3Key: { type: String, required: true },
    fileName: { type: String, required: true },
    url: { type: String, required: true },
    thumbnailUrl: { type: String },
    width: { type: Number },
    height: { type: Number },
    fileSizeBytes: { type: Number },
    mimeType: { type: String },
  },
  { _id: false }
);

const GeneratedImageSchema = new Schema<IGeneratedImage>({
  s3Key: { type: String, required: true },
  url: { type: String, required: true },
  thumbnailUrl: { type: String },
  variationType: { type: String, required: true },
  promptUsed: { type: String, required: true },
  interactionId: { type: String, required: true }, // Gemini session ID for re-edit continuity
  isLatest: { type: Boolean, default: true },
  replacedBy: { type: Schema.Types.ObjectId, ref: "ListingObject" },
  createdAt: { type: Date, default: Date.now },
});

const AiGeneratedTextSchema = new Schema<IAiGeneratedText>(
  {
    seoTitle: { type: String },
    seoDescription: { type: String },
    keyFeatures: [{ type: String }],
    keywords: [{ type: String }],
    meeshoListing: {
      title: { type: String },
      description: { type: String },
      category: { type: String },
      subcategory: { type: String },
    },
    whatsappCaption: { type: String },
    instagramCaption: { type: String },
    instagramHashtags: [{ type: String }],
  },
  { _id: false }
);

const SocialCardSchema = new Schema<ISocialCard>(
  {
    s3Key: { type: String, required: true },
    url: { type: String, required: true },
    templateId: { type: String },
    generatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ListingObjectSchema = new Schema<IListingObject>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["listing_product", "listing_kit"],
      required: true,
    },

    // Status
    status: {
      type: String,
      enum: ["uploaded", "queued", "processing", "completed", "failed"],
      default: "uploaded",
    },
    textStatus: {
      type: String,
      enum: ["pending", "streaming", "completed", "failed"],
      default: "pending",
    },

    // Step 1
    originalImages: [OriginalImageSchema],

    // Step 2
    userTitle: { type: String },
    userDescription: { type: String },
    userPrompt: { type: String },
    price: { type: Number },
    discountPrice: { type: Number },
    sizes: [{ type: String }],
    variants: [{ type: String }],
    ctaText: { type: String },

    // Step 3
    aiGeneratedText: AiGeneratedTextSchema,

    // Step 4
    generatedImages: [GeneratedImageSchema],

    // Cards
    whatsappCard: SocialCardSchema,
    instagramPost: SocialCardSchema,
    instagramStory: SocialCardSchema,

    // Prompt enhancement
    enhancedPrompt: { type: String },

    // Credits
    creditsCharged: { type: Number, required: true, default: 0 },
    creditsRefunded: { type: Boolean, default: false },

    // Job tracking
    bullmqJobId: { type: String },
    errorMessage: { type: String },
    retryCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Compound index for user's listing history, sorted by newest first
ListingObjectSchema.index({ userId: 1, createdAt: -1 });
// Index for BullMQ job lookup
ListingObjectSchema.index({ bullmqJobId: 1 }, { sparse: true });
// Index for admin: filter by status
ListingObjectSchema.index({ status: 1 });

export const ListingObject: Model<IListingObject> =
  (mongoose.models.ListingObject as Model<IListingObject>) ||
  mongoose.model<IListingObject>("ListingObject", ListingObjectSchema);
