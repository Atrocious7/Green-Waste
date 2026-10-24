import mongoose, { Schema, Document } from "mongoose";

export interface IReward extends Document {
  businessId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  coinCost: number;
  quantity: number;
  status: "active" | "inactive" | "deleted";
  createdAt: Date;
  updatedAt: Date;
}

const RewardSchema = new Schema<IReward>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    title: { type: String, required: true },
    description: { type: String },
    coinCost: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ["active", "inactive", "deleted"], default: "active" },
  },
  { timestamps: true }
);

export default mongoose.models.Reward || mongoose.model<IReward>("Reward", RewardSchema);
