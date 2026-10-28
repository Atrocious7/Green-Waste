import mongoose, { Schema } from "mongoose";
const AdminRoleGuardSchema = new Schema({
    _id: { type: String, required: true },
    version: { type: Number, required: true, default: 0 },
}, { versionKey: false });
export default mongoose.models.AdminRoleGuard ||
    mongoose.model("AdminRoleGuard", AdminRoleGuardSchema);
