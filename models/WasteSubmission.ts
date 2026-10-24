import mongoose, { Schema, Document } from "mongoose";

export type WasteCategory =
  | "pending"
  | "Plastic"
  | "Paper"
  | "Glass"
  | "Metal"
  | "Organic"
  | "E-waste"
  | "Non-recyclable";

export interface IWasteSubmission extends Document {
  userId: mongoose.Types.ObjectId;
  imageUrl?: string;
  category?: WasteCategory;
  predictedLabels: { label: string; score: number }[];
  confidence?: number; // percentage 0-100
  coinsAwarded: number;
  rewardProcessed: boolean;
  idempotencyKey?: string;
  status: "pending" | "approved" | "awarded" | "needs_review" | "rejected";
  location?: { lat: number; lng: number };
  createdAt: Date;
  updatedAt: Date;
}

const WasteSubmissionSchema = new Schema<IWasteSubmission>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    imageUrl: { type: String, required: false },
    category: {
      type: String,
      enum: ["pending", "Plastic", "Paper", "Glass", "Metal", "Organic", "E-waste", "Non-recyclable"],
      default: "pending",
      required: false,
    },
    predictedLabels: {
      type: [
        {
          label: String,
          score: Number,
        },
      ],
      default: [],
    },
    confidence: { type: Number, default: 0 },
    coinsAwarded: { type: Number, default: 0 },
    rewardProcessed: { type: Boolean, default: false },
    idempotencyKey: { type: String, immutable: true },
    status: { type: String, enum: ["pending", "approved", "awarded", "needs_review", "rejected"], default: "pending" },
    location: {
      lat: Number,
      lng: Number,
    },
  },
  { timestamps: true }
);

WasteSubmissionSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
    name: "unique_user_waste_submission_idempotency_key",
  }
);

export default mongoose.models.WasteSubmission || mongoose.model<IWasteSubmission>("WasteSubmission", WasteSubmissionSchema);
