import { NextResponse } from "next/server";

import { getAuthenticatedBusiness } from "@/lib/businessAuth";
import Redemption from "@/models/Redemption";
import Reward from "@/models/Reward";

export async function GET() {
  const auth = await getAuthenticatedBusiness();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { business } = auth;

  try {
    const [
      activeRewardsCount,
      totalRewardsCount,
      stockResult,
      redeemedCount,
      pendingCount,
      coinsResult,
    ] = await Promise.all([
      Reward.countDocuments({ businessId: business._id, status: "active" }),
      Reward.countDocuments({ businessId: business._id, status: { $ne: "deleted" } }),
      Reward.aggregate<{ totalStock: number }>([
        { $match: { businessId: business._id, status: "active" } },
        { $group: { _id: null, totalStock: { $sum: "$quantity" } } },
      ]),
      Redemption.countDocuments({
        businessId: business._id,
        status: { $in: ["redeemed", "completed"] },
      }),
      Redemption.countDocuments({
        businessId: business._id,
        status: "pending",
      }),
      Redemption.aggregate<{ totalCoins: number }>([
        {
          $match: {
            businessId: business._id,
            status: { $in: ["redeemed", "completed"] },
          },
        },
        { $group: { _id: null, totalCoins: { $sum: "$coinsUsed" } } },
      ]),
    ]);

    const totalAvailableStock = stockResult[0]?.totalStock ?? 0;
    const totalCoinsClaimed = coinsResult[0]?.totalCoins ?? 0;

    return NextResponse.json({
      business: {
        id: String(business._id),
        businessName: business.businessName,
        email: business.email,
        address: business.address ?? "",
        description: business.description ?? "",
        verified: business.verified,
        createdAt: business.createdAt,
      },
      stats: {
        activeRewardsCount,
        totalRewardsCount,
        totalAvailableStock,
        redeemedCount,
        pendingCount,
        totalCoinsClaimed,
      },
    });
  } catch (error) {
    console.error("Failed to load business dashboard stats:", error);
    return NextResponse.json({ error: "Unable to load business dashboard statistics." }, { status: 500 });
  }
}
