import mongoose, { Schema, Document } from "mongoose";

export interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId;
  type: "award" | "redeem" | "adjustment";
  amount: number; // positive for award, negative for spend
  referenceId?: mongoose.Types.ObjectId; // submission or redemption
  note?: string;
  balanceAfter?: number;
  createdAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["award", "redeem", "adjustment"], required: true },
    amount: { type: Number, required: true },
    referenceId: { type: Schema.Types.ObjectId },
    note: { type: String },
    balanceAfter: { type: Number, min: 0 },
  },
  { timestamps: true }
);

TransactionSchema.index(
  { referenceId: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "award", referenceId: { $type: "objectId" } },
    name: "unique_award_transaction_per_reference",
  }
);

export default mongoose.models.Transaction || mongoose.model<ITransaction>("Transaction", TransactionSchema);
