import mongoose, { Schema, Document, Types, Model } from "mongoose";

export interface IPayment extends Document {
  userId: Types.ObjectId;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  status: "created" | "authorized" | "captured" | "failed" | "refunded";
  amountPaise: number;          // always in paise (₹99 = 9900 paise)
  currency: string;
  packId: string;               // "trial" | "starter" | "standard" | "pro" | "topup" | ...
  creditsPurchased: number;
  topupQuantity?: number;       // only for topup pack
  razorpayMetadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    status: {
      type: String,
      enum: ["created", "authorized", "captured", "failed", "refunded"],
      default: "created",
    },
    amountPaise: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    packId: { type: String, required: true },
    creditsPurchased: { type: Number, required: true },
    topupQuantity: { type: Number },
    razorpayMetadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const Payment: Model<IPayment> =
  (mongoose.models.Payment as Model<IPayment>) ||
  mongoose.model<IPayment>("Payment", PaymentSchema);
