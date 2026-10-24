import { NextResponse } from "next/server";

import { getAuthenticatedBusiness } from "@/lib/businessAuth";
import Redemption from "@/models/Redemption";
import Reward from "@/models/Reward";
import User from "@/models/User";

export async function GET() {
  const auth = await getAuthenticatedBusiness();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { business } = auth;

  try {
    // Ensure models are registered for populate
    void Reward;
    void User;

    const redemptions = await Redemption.find({ businessId: business._id })
      .populate("rewardId", "title description coinCost status")
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .lean();

    type PopulatedReward = {
      _id?: unknown;
      title?: string;
      description?: string;
      coinCost?: number;
      status?: string;
    };

    type PopulatedUser = {
      _id?: unknown;
      name?: string;
      email?: string;
    };

    return NextResponse.json({
      redemptions: redemptions.map((red) => {
        const reward = red.rewardId as PopulatedReward | null;
        const customer = red.userId as PopulatedUser | null;

        return {
          id: String(red._id),
          redemptionCode: red.redemptionCode,
          coinsUsed: red.coinsUsed,
          status: red.status,
          createdAt: red.createdAt,
          updatedAt: (red as Record<string, unknown>).updatedAt,
          reward: reward
            ? {
                id: reward._id ? String(reward._id) : String(red.rewardId),
                title: reward.title ?? "Reward",
                description: reward.description ?? "",
                coinCost: reward.coinCost ?? red.coinsUsed,
                status: reward.status,
              }
            : null,
          customer: customer
            ? {
                id: customer._id ? String(customer._id) : String(red.userId),
                name: customer.name ?? "Citizen",
                email: customer.email ?? "",
              }
            : null,
        };
      }),
    });
  } catch (error) {
    console.error("Failed to fetch business redemptions:", error);
    return NextResponse.json({ error: "Unable to load redemptions right now." }, { status: 500 });
  }
}
