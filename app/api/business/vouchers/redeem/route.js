import { NextResponse } from "next/server";

import { getAuthenticatedBusiness } from "@/lib/businessAuth";
import Redemption from "@/models/Redemption";
import Reward from "@/models/Reward";
import User from "@/models/User";

export async function POST(request) {
  const auth = await getAuthenticatedBusiness();
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { business } = auth;

  if (!business.verified || business.suspended) {
    return NextResponse.json(
      { error: "This business is unverified or suspended and cannot redeem vouchers." },
      { status: 403 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const { redemptionCode } = body || {};

  if (!redemptionCode || typeof redemptionCode !== "string" || redemptionCode.trim().length === 0) {
    return NextResponse.json({ error: "Please enter a voucher code to redeem." }, { status: 400 });
  }

  const normalizedCode = redemptionCode.trim().toUpperCase();

  try {
    // Ensure models are registered for population
    void Reward;
    void User;

    // 1. Initial lookup to provide precise, actionable error messages
    const existing = await Redemption.findOne({ redemptionCode: normalizedCode }).lean();

    if (!existing) {
      return NextResponse.json(
        { error: "Voucher code not found. Please verify the code and try again." },
        { status: 404 }
      );
    }

    // 2. Strict business ownership check: voucher must belong to this authenticated business
    if (String(existing.businessId) !== String(business._id)) {
      return NextResponse.json(
        { error: "This voucher was issued for a different partner business and cannot be redeemed here." },
        { status: 403 }
      );
    }

    // 3. Status checks
    if (existing.status === "redeemed" || existing.status === "completed") {
      const redeemedDate = existing.updatedAt
        ? new Date(existing.updatedAt).toLocaleDateString()
        : "earlier";
      return NextResponse.json(
        { error: `This voucher has already been redeemed (${redeemedDate}). Duplicate use is prohibited.` },
        { status: 400 }
      );
    }

    if (existing.status === "cancelled") {
      return NextResponse.json(
        { error: "This voucher has been cancelled and cannot be redeemed." },
        { status: 400 }
      );
    }

    if (existing.status !== "pending") {
      return NextResponse.json(
        { error: `Voucher is in '${existing.status}' status and cannot be redeemed.` },
        { status: 400 }
      );
    }

    // 4. Atomic conditional update scoped to this business and status === "pending"
    // Prevents duplicate use and concurrent race conditions
    const updated = await Redemption.findOneAndUpdate(
      {
        _id: existing._id,
        businessId: business._id,
        status: "pending",
      },
      {
        $set: { status: "redeemed" },
      },
      {
        new: true,
      }
    )
      .populate("rewardId", "title description coinCost")
      .populate("userId", "name email");

    if (!updated) {
      return NextResponse.json(
        { error: "Voucher was already redeemed or is currently being processed by another request." },
        { status: 409 }
      );
    }

    const reward = updated.rewardId;
    const customer = updated.userId;

    return NextResponse.json({
      message: "Voucher successfully validated and marked as redeemed!",
      voucher: {
        id: String(updated._id),
        redemptionCode: updated.redemptionCode,
        status: updated.status,
        coinsUsed: updated.coinsUsed,
        redeemedAt: updated.updatedAt,
        reward: reward
          ? {
              id: reward._id ? String(reward._id) : String(updated.rewardId),
              title: reward.title ?? "Reward",
              description: reward.description ?? "",
              coinCost: reward.coinCost ?? updated.coinsUsed,
            }
          : null,
        customer: customer
          ? {
              id: customer._id ? String(customer._id) : String(updated.userId),
              name: customer.name ?? "Citizen",
              email: customer.email ?? "",
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Failed to redeem voucher:", error);
    return NextResponse.json({ error: "Unable to process voucher redemption right now." }, { status: 500 });
  }
}
