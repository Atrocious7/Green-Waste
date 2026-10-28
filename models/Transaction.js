import mongoose, { Schema } from "mongoose";
const TransactionSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["award", "redeem", "adjustment"], required: true },
    amount: { type: Number, required: true },
    referenceId: { type: Schema.Types.ObjectId },
    note: { type: String },
    balanceAfter: { type: Number, min: 0 },
}, { timestamps: true });
TransactionSchema.index({ referenceId: 1 }, {
    unique: true,
    partialFilterExpression: { type: "award", referenceId: { $type: "objectId" } },
    name: "unique_award_transaction_per_reference",
});
export default mongoose.models.Transaction || mongoose.model("Transaction", TransactionSchema);
