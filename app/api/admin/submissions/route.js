import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/adminAuth";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import WasteSubmission from "@/models/WasteSubmission";
export async function GET(req) {
    const auth = await getAuthenticatedAdmin();
    if (auth.errorResponse) {
        return auth.errorResponse;
    }
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
        const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
        const skip = (page - 1) * limit;
        const status = searchParams.get("status")?.trim() || "";
        const category = searchParams.get("category")?.trim() || "";
        const search = searchParams.get("search")?.trim() || "";
        const query = {};
        if (status && ["pending", "approved", "awarded", "needs_review", "rejected"].includes(status)) {
            query.status = status;
        }
        if (category && ["Plastic", "Paper", "Glass", "Metal", "Organic", "E-waste", "Non-recyclable", "pending"].includes(category)) {
            query.category = category;
        }
        if (search) {
            const userIds = await User.find({
                $or: [
                    { name: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                ],
            }).select("_id").lean();
            const userIdList = userIds.map((u) => u._id);
            query.userId = { $in: userIdList };
        }
        const [submissions, totalCount] = await Promise.all([
            WasteSubmission.find(query)
                .populate("userId", "name email greenCoins role")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            WasteSubmission.countDocuments(query),
        ]);
        const totalPages = Math.ceil(totalCount / limit) || 1;
        return NextResponse.json({
            submissions: submissions.map((sub) => ({
                id: String(sub._id),
                imageUrl: sub.imageUrl,
                category: sub.category ?? "pending",
                confidence: sub.confidence ?? 0,
                coinsAwarded: sub.coinsAwarded ?? 0,
                status: sub.status ?? "pending",
                rewardProcessed: sub.rewardProcessed ?? false,
                createdAt: sub.createdAt,
                updatedAt: sub.updatedAt,
                user: sub.userId
                    ? {
                        id: String(sub.userId._id),
                        name: sub.userId.name,
                        email: sub.userId.email,
                        greenCoins: sub.userId.greenCoins ?? 0,
                    }
                    : null,
            })),
            pagination: {
                currentPage: page,
                totalPages,
                totalCount,
                limit,
            },
        });
    }
    catch (error) {
        console.error("Failed to list submissions for admin:", error);
        return NextResponse.json({ error: "Unable to retrieve submission list." }, { status: 500 });
    }
}
