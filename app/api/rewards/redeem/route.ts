import crypto from "crypto";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Business from "@/models/Business";
import Redemption from "@/models/Redemption";
import Reward from "@/models/Reward";
import Transaction from "@/models/Transaction";
import User from "@/models/User";

interface RedemptionError extends Error {
  statusCode?: number;
  code?: number;
}

export async function POST(request: Request) {
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
    return NextResponse.json({ error: "Only citizens can redeem rewards." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const { rewardId } = (body as { rewardId?: unknown }) || {};

  if (!rewardId || typeof rewardId !== "string" || !mongoose.Types.ObjectId.isValid(rewardId)) {
    return NextResponse.json({ error: "A valid reward ID is required." }, { status: 400 });
  }

  try {
    await dbConnect();

    // Ensure models and schemas are initialized
    await Promise.all([
      Reward.init(),
      Redemption.init(),
      Transaction.init(),
      User.init(),
      Business.init(),
    ]);

    const sessionDb = await mongoose.startSession();
    let redemptionResult: {
      redemptionId: string;
      redemptionCode: string;
      rewardTitle: string;
      coinsUsed: number;
      balanceAfter: number;
      businessName: string;
      createdAt: Date;
    } | null = null;

    try {
      await sessionDb.withTransaction(async () => {
        // 1. Fetch citizen within transaction
        const citizen = await User.findOne({
          _id: session.user.id,
          role: "citizen",
        }).session(sessionDb);

        if (!citizen) {
          const err: RedemptionError = new Error("Citizen account not found.");
          err.statusCode = 404;
          throw err;
        }

        // 2. Fetch reward within transaction
        const reward = await Reward.findOne({
          _id: rewardId,
        }).session(sessionDb);

        if (!reward || reward.status !== "active") {
          const err: RedemptionError = new Error("This reward is not available.");
          err.statusCode = 404;
          throw err;
        }

        if (reward.quantity <= 0) {
          const err: RedemptionError = new Error("This reward is currently out of stock.");
          err.statusCode = 400;
          throw err;
        }

        if (citizen.greenCoins < reward.coinCost) {
          const err: RedemptionError = new Error(
            `Insufficient Green Coins. You need ${reward.coinCost} coins, but have ${citizen.greenCoins}.`
          );
          err.statusCode = 400;
          throw err;
        }

        // 3. Atomically decrement stock with strictly guarded query
        const updatedReward = await Reward.findOneAndUpdate(
          {
            _id: reward._id,
            status: "active",
            quantity: { $gt: 0 },
          },
          { $inc: { quantity: -1 } },
          { session: sessionDb, new: true }
        );

        if (!updatedReward) {
          const err: RedemptionError = new Error("This reward is out of stock or no longer available.");
          err.statusCode = 409;
          throw err;
        }

        // 4. Atomically deduct citizen coins with balance guard
        const updatedCitizen = await User.findOneAndUpdate(
          {
            _id: citizen._id,
            role: "citizen",
            greenCoins: { $gte: reward.coinCost },
          },
          { $inc: { greenCoins: -reward.coinCost } },
          { session: sessionDb, new: true, runValidators: true }
        );

        if (!updatedCitizen) {
          const err: RedemptionError = new Error("Insufficient Green Coins to complete redemption.");
          err.statusCode = 400;
          throw err;
        }

        // 5. Generate unique, cryptographically secure voucher code
        const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
        const timeBase36 = Math.floor(Date.now() / 1000).toString(36).toUpperCase();
        const redemptionCode = `GS-${timeBase36}-${randomHex}`;

        // 6. Create Redemption record
        const [createdRedemption] = await Redemption.create(
          [
            {
              userId: citizen._id,
              rewardId: reward._id,
              businessId: reward.businessId,
              coinsUsed: reward.coinCost,
              redemptionCode,
              status: "pending",
            },
          ],
          { session: sessionDb }
        );

        // 7. Create Transaction record with type: "redeem", negative amount, balanceAfter
        await Transaction.create(
          [
            {
              userId: citizen._id,
              type: "redeem",
              amount: -reward.coinCost,
              referenceId: createdRedemption._id,
              note: `Redeemed reward: ${reward.title}`,
              balanceAfter: updatedCitizen.greenCoins,
            },
          ],
          { session: sessionDb }
        );

        // Lookup business name for response details
        const business = await Business.findById(reward.businessId).session(sessionDb).lean();

        redemptionResult = {
          redemptionId: String(createdRedemption._id),
          redemptionCode: createdRedemption.redemptionCode,
          rewardTitle: reward.title,
          coinsUsed: reward.coinCost,
          balanceAfter: updatedCitizen.greenCoins,
          businessName: business?.businessName || "Partner Business",
          createdAt: createdRedemption.createdAt,
        };
      });

      return NextResponse.json(
        {
          message: "Reward redeemed successfully!",
          redemption: redemptionResult,
        },
        { status: 201 }
      );
    } catch (txError: unknown) {
      const err = txError as RedemptionError;
      if (err?.statusCode) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode });
      }
      if (err?.code === 11000) {
        return NextResponse.json(
          { error: "A voucher code collision occurred. Please try again." },
          { status: 409 }
        );
      }
      console.error("Redemption transaction failed:", err);
      return NextResponse.json(
        { error: err?.message || "Failed to process redemption. No coins were deducted." },
        { status: 500 }
      );
    } finally {
      await sessionDb.endSession();
    }
  } catch (error) {
    console.error("Redemption route preparation error:", error);
    return NextResponse.json({ error: "Unable to process redemption right now." }, { status: 500 });
  }
}
