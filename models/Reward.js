import mongoose, { Schema } from "mongoose";
const RewardSchema = new Schema({
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    title: { type: String, required: true },
    description: { type: String },
    coinCost: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ["active", "inactive", "deleted"], default: "active" },
}, { timestamps: true });
export default mongoose.models.Reward || mongoose.model("Reward", RewardSchema);
