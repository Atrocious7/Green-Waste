import type { Document, Model, Types } from "mongoose";

export interface IReward extends Document {
  businessId: Types.ObjectId;
  title: string;
  description?: string;
  coinCost: number;
  quantity: number;
  status: "active" | "inactive" | "deleted";
  createdAt: Date;
  updatedAt: Date;
}

declare const Reward: Model<IReward>;
export default Reward;
