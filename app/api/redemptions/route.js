import { NextResponse } from "next/server";
import { getAuthenticatedCitizen } from "@/lib/citizenAuth";
import dbConnect from "@/lib/db";
import Business from "@/models/Business";
import Redemption from "@/models/Redemption";
import Reward from "@/models/Reward";
export async function GET() {
    const auth = await getAuthenticatedCitizen("Only citizens can access redemption history.");
    if (auth.errorResponse)
        return auth.errorResponse;
    try {
        await dbConnect();
        // Ensure models are registered for population
        void Business;
        void Reward;
        const redemptions = await Redemption.find({ userId: auth.user.id })
            .populate("rewardId", "title description coinCost")
            .populate("businessId", "businessName address")
            .sort({ createdAt: -1 })
            .lean();
        return NextResponse.json({
            redemptions: redemptions.map((red) => {
                const reward = red.rewardId;
                const biz = red.businessId;
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
    }
    catch (error) {
        console.error("Fetch redemptions error:", error);
        return NextResponse.json({ error: "Unable to load redemptions right now." }, { status: 500 });
    }
}
