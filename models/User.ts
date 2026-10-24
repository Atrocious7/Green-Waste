import mongoose, { Schema, Document } from "mongoose";

export type UserRole = "citizen" | "business" | "admin";

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  greenCoins: number;
  business?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["citizen", "business", "admin"], default: "citizen" },
    greenCoins: { type: Number, min: 0, default: 0 },
    business: { type: Schema.Types.ObjectId, ref: "Business", required: false },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
