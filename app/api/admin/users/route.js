import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/adminAuth";
import dbConnect from "@/lib/db";
import User from "@/models/User";
export async function GET(req) {
    const auth = await getAuthenticatedAdmin();
    if (auth.errorResponse) {
        return auth.errorResponse;
    }
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search")?.trim() || "";
        const role = searchParams.get("role")?.trim() || "";
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
        const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
        const skip = (page - 1) * limit;
        const query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }
        if (role && ["citizen", "business", "admin"].includes(role)) {
            query.role = role;
        }
        const [users, totalCount] = await Promise.all([
            User.find(query)
                .select("-passwordHash")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            User.countDocuments(query),
        ]);
        const totalPages = Math.ceil(totalCount / limit) || 1;
        return NextResponse.json({
            users: users.map((u) => ({
                id: String(u._id),
                name: u.name,
                email: u.email,
                role: u.role,
                greenCoins: u.greenCoins ?? 0,
                businessId: u.business ? String(u.business) : null,
                createdAt: u.createdAt,
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
        console.error("Failed to list users for admin:", error);
        return NextResponse.json({ error: "Unable to retrieve user list." }, { status: 500 });
    }
}
