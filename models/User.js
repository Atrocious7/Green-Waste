import mongoose, { Schema } from "mongoose";
const UserSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["citizen", "business", "admin"], default: "citizen" },
    greenCoins: { type: Number, min: 0, default: 0 },
    business: { type: Schema.Types.ObjectId, ref: "Business", required: false },
}, { timestamps: true });
export default mongoose.models.User || mongoose.model("User", UserSchema);
