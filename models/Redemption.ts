import mongoose, { Schema, Document } from "mongoose";

export interface IRedemption extends Document {
  userId: mongoose.Types.ObjectId;
  rewardId: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  coinsUsed: number;
  redemptionCode: string;
  status: "pending" | "completed" | "cancelled" | "redeemed";
  createdAt: Date;
}

const RedemptionSchema = new Schema<IRedemption>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rewardId: { type: Schema.Types.ObjectId, ref: "Reward", required: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    coinsUsed: { type: Number, required: true },
    redemptionCode: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "completed", "cancelled", "redeemed"], default: "pending" },
  },
  { timestamps: true }
);

export default mongoose.models.Redemption || mongoose.model<IRedemption>("Redemption", RedemptionSchema);
