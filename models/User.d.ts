import type { Document, Model, Types } from "mongoose";

export type UserRole = "citizen" | "business" | "admin";

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  greenCoins: number;
  business?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

declare const User: Model<IUser>;
export default User;
