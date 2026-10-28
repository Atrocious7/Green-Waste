import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/adminAuth";
import dbConnect from "@/lib/db";
import Business from "@/models/Business";
import Reward from "@/models/Reward";
const REWARD_STATUSES = ["active", "inactive", "deleted"];
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export async function GET(request) {
    const auth = await getAuthenticatedAdmin();
    if (auth.errorResponse)
        return auth.errorResponse;
    const params = request.nextUrl.searchParams;
    const search = params.get("search")?.trim() ?? "";
    const businessId = params.get("businessId")?.trim() ?? "";
    const status = params.get("status")?.trim() ?? "";
    const parsedPage = Number(params.get("page") ?? "1");
    const parsedLimit = Number(params.get("limit") ?? "10");
    if (!Number.isInteger(parsedPage) || parsedPage < 1 || !Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
        return NextResponse.json({ error: "Page must be a positive integer and limit must be between 1 and 50." }, { status: 400 });
    }
    if (businessId && !mongoose.Types.ObjectId.isValid(businessId)) {
        return NextResponse.json({ error: "Invalid business ID." }, { status: 400 });
    }
    if (status && !REWARD_STATUSES.includes(status)) {
        return NextResponse.json({ error: "Invalid reward status." }, { status: 400 });
    }
    try {
        await dbConnect();
        void Business;
        const rewardQuery = {};
        if (businessId)
            rewardQuery.businessId = businessId;
        if (status)
            rewardQuery.status = status;
        if (search) {
            const pattern = new RegExp(escapeRegex(search), "i");
            const matchingBusinesses = await Business.find({ businessName: pattern }).select("_id").lean();
            rewardQuery.$or = [
                { title: pattern },
                { businessId: { $in: matchingBusinesses.map((business) => business._id) } },
            ];
        }
        const skip = (parsedPage - 1) * parsedLimit;
        const [rewards, totalCount, businesses] = await Promise.all([
            Reward.find(rewardQuery)
                .populate({ path: "businessId", select: "businessName verified suspended" })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parsedLimit)
                .lean(),
            Reward.countDocuments(rewardQuery),
            Business.find({}).select("businessName").sort({ businessName: 1 }).lean(),
        ]);
        return NextResponse.json({
            rewards: rewards.map((reward) => {
                const business = reward.businessId;
                return {
                    id: String(reward._id),
                    title: reward.title,
                    description: reward.description ?? "",
                    coinCost: reward.coinCost,
                    quantity: reward.quantity,
                    status: reward.status,
                    createdAt: reward.createdAt,
                    updatedAt: reward.updatedAt,
                    business: business
                        ? {
                            id: String(business._id),
                            name: business.businessName ?? "Unknown business",
                            verified: Boolean(business.verified),
                            suspended: Boolean(business.suspended),
                        }
                        : null,
                };
            }),
            businesses: businesses.map((business) => ({ id: String(business._id), name: business.businessName })),
            pagination: {
                currentPage: parsedPage,
                totalPages: Math.ceil(totalCount / parsedLimit) || 1,
                totalCount,
                limit: parsedLimit,
            },
        });
    }
    catch (error) {
        console.error("Failed to list admin rewards:", error);
        return NextResponse.json({ error: "Unable to retrieve rewards." }, { status: 500 });
    }
}
