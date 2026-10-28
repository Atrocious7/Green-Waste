import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/adminAuth";
import dbConnect from "@/lib/db";
import Business from "@/models/Business";
import User from "@/models/User";
export async function GET(req) {
    const auth = await getAuthenticatedAdmin();
    if (auth.errorResponse) {
        return auth.errorResponse;
    }
    try {
        await dbConnect();
        void User;
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search")?.trim() || "";
        const verified = searchParams.get("verified")?.trim() || "";
        const suspended = searchParams.get("suspended")?.trim() || "";
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
        const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
        const skip = (page - 1) * limit;
        const query = {};
        if (search) {
            query.$or = [
                { businessName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }
        if (verified === "true" || verified === "false") {
            query.verified = verified === "true";
        }
        if (suspended === "true" || suspended === "false") {
            query.suspended = suspended === "true";
        }
        // Find businesses with populated user (for email)
        const [businesses, totalCount] = await Promise.all([
            Business.find(query)
                .populate("userId", "email")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Business.countDocuments(query),
        ]);
        const totalPages = Math.ceil(totalCount / limit) || 1;
        return NextResponse.json({
            businesses: businesses.map((b) => {
                const user = b.userId;
                return {
                    id: String(b._id),
                    businessName: b.businessName,
                    email: b.email,
                    userEmail: user?.email ?? b.email,
                    address: b.address ?? "",
                    description: b.description ?? "",
                    verified: b.verified,
                    suspended: b.suspended,
                    createdAt: b.createdAt,
                    updatedAt: b.updatedAt,
                };
            }),
            pagination: {
                currentPage: page,
                totalPages,
                totalCount,
                limit,
            },
        });
    }
    catch (error) {
        console.error("Failed to list businesses for admin:", error);
        return NextResponse.json({ error: "Unable to retrieve business list." }, { status: 500 });
    }
}
