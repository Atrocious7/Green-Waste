import mongoose, { Schema } from "mongoose";
const BusinessSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    businessName: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String },
    description: { type: String },
    verified: { type: Boolean, default: false },
    suspended: { type: Boolean, default: false },
}, { timestamps: true });
export default mongoose.models.Business || mongoose.model("Business", BusinessSchema);
