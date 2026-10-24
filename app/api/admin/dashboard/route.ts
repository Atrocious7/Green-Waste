import { NextResponse } from "next/server";

import { getAuthenticatedAdmin } from "@/lib/adminAuth";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import WasteSubmission from "@/models/WasteSubmission";
import Redemption from "@/models/Redemption";

export async function GET() {
  const auth = await getAuthenticatedAdmin();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    await dbConnect();

    const [
      totalUsers,
      totalCitizens,
      totalBusinesses,
      totalSubmissions,
      approvedSubmissions,
      pendingSubmissions,
      coinAgg,
      totalRedemptions,
      recentSubmissions,
      recentRedemptions,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: "citizen" }),
      User.countDocuments({ role: "business" }),
      WasteSubmission.countDocuments({}),
      WasteSubmission.countDocuments({ status: { $in: ["approved", "awarded"] } }),
      WasteSubmission.countDocuments({ status: { $in: ["pending", "needs_review"] } }),
      User.aggregate([{ $group: { _id: null, totalCoins: { $sum: "$greenCoins" } } }]),
      Redemption.countDocuments({}),
      WasteSubmission.find({})
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Redemption.find({})
        .populate("userId", "name email")
        .populate("rewardId", "title coinCost")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const totalGreenCoins = coinAgg[0]?.totalCoins ?? 0;

    return NextResponse.json({
      stats: {
        totalUsers,
        totalCitizens,
        totalBusinesses,
        totalSubmissions,
        approvedSubmissions,
        pendingSubmissions,
        totalGreenCoins,
        totalRedemptions,
      },
      recentSubmissions: recentSubmissions.map((sub) => {
        const user = sub.userId as unknown as { name: string; email: string } | null;
        return {
          id: String(sub._id),
          category: sub.category ?? "pending",
          status: sub.status ?? "pending",
          confidence: sub.confidence ?? 0,
          coinsAwarded: sub.coinsAwarded ?? 0,
          createdAt: sub.createdAt,
          user: user ? { name: user.name, email: user.email } : null,
        };
      }),
      recentRedemptions: recentRedemptions.map((red) => {
        const user = red.userId as unknown as { name: string; email: string } | null;
        const reward = red.rewardId as unknown as { title: string; coinCost: number } | null;
        return {
          id: String(red._id),
          redemptionCode: red.redemptionCode,
          coinsUsed: red.coinsUsed,
          status: red.status,
          createdAt: red.createdAt,
          reward: reward ? { title: reward.title, coinCost: reward.coinCost } : null,
          user: user ? { name: user.name, email: user.email } : null,
        };
      }),
    });
  } catch (error) {
    console.error("Failed to load admin dashboard overview:", error);
    return NextResponse.json({ error: "Unable to load dashboard statistics." }, { status: 500 });
  }
}
