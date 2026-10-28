import mongoose, { Schema } from "mongoose";
const RedemptionSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rewardId: { type: Schema.Types.ObjectId, ref: "Reward", required: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    coinsUsed: { type: Number, required: true },
    idempotencyKey: { type: String, immutable: true },
    rewardTitleSnapshot: { type: String },
    businessNameSnapshot: { type: String },
    balanceAfter: { type: Number, min: 0 },
    redemptionCode: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "completed", "cancelled", "redeemed"], default: "pending" },
}, { timestamps: true });
RedemptionSchema.index({ userId: 1, idempotencyKey: 1 }, {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
    name: "unique_user_redemption_idempotency_key",
});
export default mongoose.models.Redemption || mongoose.model("Redemption", RedemptionSchema);
