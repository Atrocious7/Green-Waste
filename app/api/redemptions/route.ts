import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Business from "@/models/Business";
import Redemption from "@/models/Redemption";
import Reward from "@/models/Reward";

export async function GET() {
  let session;
  try {
    session = await getServerSession(authOptions);
  } catch {
    return NextResponse.json({ error: "Unable to verify your session." }, { status: 500 });
  }

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
  }

  if (session.user.role !== "citizen") {
    return NextResponse.json({ error: "Only citizens can access redemption history." }, { status: 403 });
  }

  try {
    await dbConnect();

    // Ensure models are registered for population
    void Business;
    void Reward;

    const redemptions = await Redemption.find({ userId: session.user.id })
      .populate("rewardId", "title description coinCost")
      .populate("businessId", "businessName address")
      .sort({ createdAt: -1 })
      .lean();

    type PopulatedReward = {
      _id?: unknown;
      title?: string;
      description?: string;
      coinCost?: number;
    };

    type PopulatedBusiness = {
      _id?: unknown;
      businessName?: string;
      address?: string;
    };

    return NextResponse.json({
      redemptions: redemptions.map((red) => {
        const reward = red.rewardId as PopulatedReward | null;
        const biz = red.businessId as PopulatedBusiness | null;

        return {
          id: String(red._id),
          redemptionCode: red.redemptionCode,
          coinsUsed: red.coinsUsed,
          status: red.status,
          createdAt: red.createdAt,
          reward: reward
            ? {
                id: reward._id ? String(reward._id) : String(red.rewardId),
                title: reward.title ?? "Reward",
                description: reward.description ?? "",
                coinCost: reward.coinCost ?? red.coinsUsed,
              }
            : null,
          business: biz
            ? {
                id: biz._id ? String(biz._id) : String(red.businessId),
                name: biz.businessName ?? "Partner Business",
                address: biz.address ?? "",
              }
            : null,
        };
      }),
    });
  } catch (error) {
    console.error("Fetch redemptions error:", error);
    return NextResponse.json({ error: "Unable to load redemptions right now." }, { status: 500 });
  }
}
