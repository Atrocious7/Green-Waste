import { NextResponse } from "next/server";
import { getAuthenticatedCitizen } from "@/lib/citizenAuth";
import dbConnect from "@/lib/db";
import Business from "@/models/Business";
import Reward from "@/models/Reward";
export async function GET() {
    const auth = await getAuthenticatedCitizen("Only citizens can access the rewards catalog.");
    if (auth.errorResponse)
        return auth.errorResponse;
    try {
        await dbConnect();
        // Ensure Business model is registered before populate
        void Business;
        // Only show rewards from verified businesses. Unverified businesses' rewards
        // are hidden from the public citizen catalog. The populate match filter
        // leaves businessId null for unverified businesses, so we drop those rows.
        const rewards = await Reward.find({ status: "active", quantity: { $gt: 0 } })
            .populate({ path: "businessId", match: { verified: true, suspended: { $ne: true } } })
            .sort({ coinCost: 1, createdAt: -1 })
            .lean();
        return NextResponse.json({
            userCoins: auth.citizen.greenCoins ?? 0,
            rewards: rewards
                .filter((reward) => reward.businessId != null)
                .map((reward) => {
                const biz = reward.businessId;
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
    }
    catch (error) {
        console.error("Fetch rewards catalog error:", error);
        return NextResponse.json({ error: "Unable to load rewards right now." }, { status: 500 });
    }
}
