import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { getAuthenticatedBusiness } from "@/lib/businessAuth";
import Redemption from "@/models/Redemption";
import Reward, { IReward } from "@/models/Reward";

export async function GET() {
  const auth = await getAuthenticatedBusiness();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { business } = auth;

  try {
    const [rewards, redemptionStats] = await Promise.all([
      Reward.find({ businessId: business._id, status: { $ne: "deleted" } })
        .sort({ createdAt: -1 })
        .lean(),
      Redemption.aggregate<{
        _id: mongoose.Types.ObjectId;
        totalRedemptions: number;
        completedRedemptions: number;
      }>([
        { $match: { businessId: business._id } },
        {
          $group: {
            _id: "$rewardId",
            totalRedemptions: { $sum: 1 },
            completedRedemptions: {
              $sum: {
                $cond: [{ $in: ["$status", ["redeemed", "completed"]] }, 1, 0],
              },
            },
          },
        },
      ]),
    ]);

    const statsMap = new Map<string, { total: number; completed: number }>();
    for (const stat of redemptionStats) {
      statsMap.set(String(stat._id), {
        total: stat.totalRedemptions,
        completed: stat.completedRedemptions,
      });
    }

    return NextResponse.json({
      rewards: rewards.map((r: IReward) => {
        const stats = statsMap.get(String(r._id)) ?? { total: 0, completed: 0 };
        return {
          id: String(r._id),
          title: r.title,
          description: r.description ?? "",
          coinCost: r.coinCost,
          quantity: r.quantity,
          status: r.status,
          totalRedemptions: stats.total,
          completedRedemptions: stats.completed,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      }),
    });
  } catch (error) {
    console.error("Failed to fetch business rewards:", error);
    return NextResponse.json({ error: "Unable to load rewards right now." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedBusiness();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { business } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const { title, description, coinCost, quantity } = (body as Record<string, unknown>) || {};

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "A valid reward title is required." }, { status: 400 });
  }

  const parsedCoinCost = Number(coinCost);
  if (!Number.isFinite(parsedCoinCost) || parsedCoinCost < 1 || !Number.isInteger(parsedCoinCost)) {
    return NextResponse.json({ error: "Coin cost must be a whole positive number (at least 1)." }, { status: 400 });
  }

  const parsedQuantity = Number(quantity);
  if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0 || !Number.isInteger(parsedQuantity)) {
    return NextResponse.json({ error: "Quantity must be a non-negative whole number (0 or more)." }, { status: 400 });
  }

  try {
    const newReward = new Reward({
      businessId: business._id,
      title: title.trim(),
      description: typeof description === "string" ? description.trim() : "",
      coinCost: parsedCoinCost,
      quantity: parsedQuantity,
      status: "active",
    });

    await newReward.save();

    return NextResponse.json(
      {
        message: "Reward created successfully.",
        reward: {
          id: String(newReward._id),
          title: newReward.title,
          description: newReward.description ?? "",
          coinCost: newReward.coinCost,
          quantity: newReward.quantity,
          status: newReward.status,
          totalRedemptions: 0,
          completedRedemptions: 0,
          createdAt: newReward.createdAt,
          updatedAt: newReward.updatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create reward:", error);
    return NextResponse.json({ error: "Unable to create reward right now." }, { status: 500 });
  }
}
