import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICreditHistoryEntry {
  type: "PURCHASE" | "DEBIT" | "REFUND" | "BONUS" | "TRIAL";
  amount: number;            // positive = earned, negative = spent
  balanceAfter: number;
  description: string;
  referenceId?: string;      // paymentId or listingObjectId
  referenceType?: "payment" | "listing_object" | "re_edit";
  createdAt: Date;
}

export interface IDefaultCta {
  text: string;              // "Buy Now", "Order via WhatsApp"
  link?: string;             // optional link
}

export interface IUser extends Document {
  clerkId: string;
  fullName: string;
  email: string;
  phone?: string;
  profileImageUrl?: string;

  // Seller profile (inline)
  storeName?: string;
  whatsappNumber?: string;
  instagramHandle?: string;
  logoUrl?: string;
  defaultCta?: IDefaultCta;

  // Credits (inline)
  creditBalance: number;
  lifetimeCreditsEarned: number;
  lifetimeCreditsSpent: number;
  creditHistory: ICreditHistoryEntry[];

  // Referral system ("Give 5, Get 5")
  referralCode?: string;
  referredBy?: string;
  referralCount?: number;
  referralCreditsEarned?: number;
  referralRewardGranted?: boolean; // true once the referrer has been paid for this user's first purchase

  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
}

const CreditHistorySchema = new Schema<ICreditHistoryEntry>(
  {
    type: {
      type: String,
      enum: ["PURCHASE", "DEBIT", "REFUND", "BONUS", "TRIAL"],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    description: { type: String, required: true },
    referenceId: { type: String },
    referenceType: { type: String, enum: ["payment", "listing_object", "re_edit"] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const UserSchema = new Schema<IUser>(
  {
    clerkId: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    profileImageUrl: { type: String },

    // Seller profile
    storeName: { type: String },
    whatsappNumber: { type: String },
    instagramHandle: { type: String },
    logoUrl: { type: String },
    defaultCta: {
      text: { type: String },
      link: { type: String },
    },

    // Credits
    creditBalance: { type: Number, default: 0 },
    lifetimeCreditsEarned: { type: Number, default: 0 },
    lifetimeCreditsSpent: { type: Number, default: 0 },
    creditHistory: [CreditHistorySchema],

    // Referral system
    referralCode: { type: String, unique: true, sparse: true, index: true },
    referredBy: { type: String, index: true },
    referralCount: { type: Number, default: 0 },
    referralCreditsEarned: { type: Number, default: 0 },
    referralRewardGranted: { type: Boolean, default: false },

    role: { type: String, enum: ["user", "admin"], default: "user" },
  },
  { timestamps: true }
);

export const User: Model<IUser> =
  (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>("User", UserSchema);
