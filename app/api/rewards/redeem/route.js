import crypto from "crypto";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { getAuthenticatedCitizen } from "@/lib/citizenAuth";
import dbConnect from "@/lib/db";
import Business from "@/models/Business";
import Redemption from "@/models/Redemption";
import Reward from "@/models/Reward";
import Transaction from "@/models/Transaction";
import User from "@/models/User";

function makeRedemptionResponse(redemption) {
  return {
    redemptionId: String(redemption._id),
    redemptionCode: redemption.redemptionCode,
    rewardTitle: redemption.rewardTitleSnapshot ?? "Reward",
    coinsUsed: redemption.coinsUsed,
    balanceAfter: redemption.balanceAfter ?? 0,
    businessName: redemption.businessNameSnapshot ?? "Partner Business",
    createdAt: redemption.createdAt,
  };
}

function idempotencyConflictResponse() {
  return NextResponse.json(
    { error: "This Idempotency-Key was already used for a different reward." },
    { status: 409 }
  );
}

export async function POST(request) {
  const auth = await getAuthenticatedCitizen("Only citizens can redeem rewards.");
  if (auth.errorResponse) return auth.errorResponse;

  const suppliedIdempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (
    !suppliedIdempotencyKey ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(suppliedIdempotencyKey)
  ) {
    return NextResponse.json({ error: "A valid Idempotency-Key header is required." }, { status: 400 });
  }
  const idempotencyKey = suppliedIdempotencyKey.toLowerCase();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const { rewardId } = body || {};

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
    try {
      const outcome = await sessionDb.withTransaction(async () => {
        const existingRedemption = await Redemption.findOne({
          userId: auth.user.id,
          idempotencyKey,
        }).session(sessionDb);

        if (existingRedemption) {
          if (String(existingRedemption.rewardId) !== rewardId) {
            const err = new Error(
              "This Idempotency-Key was already used for a different reward."
            );
            err.statusCode = 409;
            throw err;
          }

          return {
            redemption: makeRedemptionResponse(existingRedemption),
            replay: true,
          };
        }

        // 1. Fetch citizen within transaction
        const citizen = await User.findOne({
          _id: auth.user.id,
          role: "citizen",
        }).session(sessionDb);

        if (!citizen) {
          const err = new Error("Citizen account not found.");
          err.statusCode = 404;
          throw err;
        }

        // 2. Fetch reward and business within transaction
        const reward = await Reward.findOne({
          _id: rewardId,
        }).session(sessionDb);

        if (!reward || reward.status !== "active") {
          const err = new Error("This reward is not available.");
          err.statusCode = 404;
          throw err;
        }

        const business = await Business.findById(reward.businessId).session(sessionDb);
        if (!business || !business.verified || business.suspended) {
          const err = new Error("This merchant is unverified or suspended and cannot offer rewards at this time.");
          err.statusCode = 400;
          throw err;
        }

        if (reward.quantity <= 0) {
          const err = new Error("This reward is currently out of stock.");
          err.statusCode = 400;
          throw err;
        }

        if (citizen.greenCoins < reward.coinCost) {
          const err = new Error(
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
          const err = new Error("This reward is out of stock or no longer available.");
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
          const err = new Error("Insufficient Green Coins to complete redemption.");
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
              idempotencyKey,
              rewardTitleSnapshot: reward.title,
              businessNameSnapshot: business.businessName,
              balanceAfter: updatedCitizen.greenCoins,
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

        return {
          redemption: makeRedemptionResponse(createdRedemption),
          replay: false,
        };
      });

      return NextResponse.json(
        {
          message: outcome.replay ? "This redemption was already processed." : "Reward redeemed successfully!",
          redemption: outcome.redemption,
        },
        { status: outcome.replay ? 200 : 201 }
      );
    } catch (txError) {
      if (txError?.statusCode) {
        return NextResponse.json({ error: txError.message }, { status: txError.statusCode });
      }
      if (txError?.code === 11000) {
        const existingRedemption = await Redemption.findOne({
          userId: auth.user.id,
          idempotencyKey,
        }).lean();

        if (existingRedemption) {
          if (String(existingRedemption.rewardId) !== rewardId) {
            return idempotencyConflictResponse();
          }

          return NextResponse.json(
            {
              message: "This redemption was already processed.",
              redemption: makeRedemptionResponse(existingRedemption),
            },
            { status: 200 }
          );
        }

        return NextResponse.json(
          { error: "A voucher code collision occurred. Please try again." },
          { status: 409 }
        );
      }
      console.error("Redemption transaction failed:", txError);
      return NextResponse.json(
        { error: txError?.message || "Failed to process redemption. No coins were deducted." },
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
