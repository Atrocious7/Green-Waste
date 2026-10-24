import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Business from "@/models/Business";
import Reward from "@/models/Reward";
import User from "@/models/User";

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
    return NextResponse.json({ error: "Only citizens can access the rewards catalog." }, { status: 403 });
  }

  try {
    await dbConnect();
    // Ensure Business model is registered before populate
    void Business;

    const [rewards, citizen] = await Promise.all([
      Reward.find({ status: "active", quantity: { $gt: 0 } })
        .populate("businessId", "businessName address description")
        .sort({ coinCost: 1, createdAt: -1 })
        .lean(),
      User.findById(session.user.id).select("greenCoins name").lean(),
    ]);

    type PopulatedBusiness = {
      _id?: unknown;
      businessName?: string;
      address?: string;
      description?: string;
    };

    return NextResponse.json({
      userCoins: (citizen as { greenCoins?: number } | null)?.greenCoins ?? 0,
      rewards: rewards.map((reward) => {
        const biz = reward.businessId as PopulatedBusiness | null;
        return {
          id: String(reward._id),
          title: reward.title,
          description: reward.description ?? "",
          coinCost: reward.coinCost,
          quantity: reward.quantity,
          business: biz
            ? {
                id: biz._id ? String(biz._id) : String(reward.businessId),
                name: biz.businessName ?? "Partner Business",
                address: biz.address ?? "",
                description: biz.description ?? "",
              }
            : null,
          createdAt: reward.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error("Fetch rewards catalog error:", error);
    return NextResponse.json({ error: "Unable to load rewards right now." }, { status: 500 });
  }
}
