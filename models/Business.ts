import mongoose, { Schema, Document } from "mongoose";

export interface IBusiness extends Document {
  userId: mongoose.Types.ObjectId;
  businessName: string;
  email: string;
  address?: string;
  description?: string;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessSchema = new Schema<IBusiness>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    businessName: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String },
    description: { type: String },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.Business || mongoose.model<IBusiness>("Business", BusinessSchema);
