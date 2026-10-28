import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/adminAuth";
import dbConnect from "@/lib/db";
import { normalizeIdentifier } from "@/lib/normalizeIdentifier";
import Business from "@/models/Business";
import Redemption from "@/models/Redemption";
import Reward from "@/models/Reward";
import Transaction from "@/models/Transaction";
import User from "@/models/User";
const REDEMPTION_STATUSES = ["pending", "completed", "cancelled", "redeemed"];
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function parseDate(value, endOfDay = false) {
    if (!value)
        return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return null;
    if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value))
        date.setUTCHours(23, 59, 59, 999);
    return date;
}
function auditRedemption(redemption, transactions, reward, business) {
    const issues = [];
    const warnings = [];
    if (transactions.length === 0)
        issues.push("No redeem transaction references this redemption.");
    if (transactions.length > 1) {
        issues.push(`Multiple redeem transactions (${transactions.length}) reference this redemption.`);
    }
    if (transactions.some((item) => item.amount !== -redemption.coinsUsed)) {
        issues.push("Redeem transaction amount does not equal negative coinsUsed.");
    }
    if (transactions.some((item) => !normalizeIdentifier(item.userId) ||
        !normalizeIdentifier(redemption.userId) ||
        normalizeIdentifier(item.userId) !== normalizeIdentifier(redemption.userId))) {
        issues.push("Redeem transaction user does not match the redemption user.");
    }
    if (transactions.some((item) => typeof item.balanceAfter !== "number" || !Number.isFinite(item.balanceAfter) || item.balanceAfter < 0)) {
        issues.push("Redeem transaction has a missing or invalid balanceAfter.");
    }
    if (reward === null)
        issues.push("The referenced reward is missing.");
    if (business === null)
        issues.push("The referenced business is missing.");
    if (reward && reward.status !== "active")
        warnings.push(`The reward is currently ${reward.status}.`);
    if (reward && typeof reward.coinCost === "number" && reward.coinCost !== redemption.coinsUsed) {
        warnings.push("The reward's current coin cost differs from the historical coins used.");
    }
    if (reward) {
        const currentBusinessId = normalizeIdentifier(reward.businessId);
        const redemptionBusinessId = normalizeIdentifier(redemption.businessId);
        if (!currentBusinessId || !redemptionBusinessId || currentBusinessId !== redemptionBusinessId) {
            warnings.push("The reward's current business link differs from the business recorded at redemption.");
        }
    }
    if (business && (!business.verified || business.suspended))
        warnings.push("The business is currently unverified or suspended.");
    return {
        status: issues.length > 0 ? "inconsistent" : warnings.length > 0 ? "warning" : "consistent",
        explanations: [...issues, ...warnings],
    };
}
export async function GET(request) {
    const auth = await getAuthenticatedAdmin();
    if (auth.errorResponse)
        return auth.errorResponse;
    const params = request.nextUrl.searchParams;
    const search = params.get("search")?.trim() ?? "";
    const businessId = params.get("businessId")?.trim() ?? "";
    const status = params.get("status")?.trim() ?? "";
    const from = parseDate(params.get("from"));
    const to = parseDate(params.get("to"), true);
    const page = Number(params.get("page") ?? "1");
    const limit = Number(params.get("limit") ?? "10");
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
        return NextResponse.json({ error: "Page must be a positive integer and limit must be between 1 and 50." }, { status: 400 });
    }
    if (businessId && !mongoose.Types.ObjectId.isValid(businessId)) {
        return NextResponse.json({ error: "Invalid business ID." }, { status: 400 });
    }
    if (status && !REDEMPTION_STATUSES.includes(status)) {
        return NextResponse.json({ error: "Invalid redemption status." }, { status: 400 });
    }
    if (from === null || to === null || (from && to && from > to)) {
        return NextResponse.json({ error: "Invalid redemption date range." }, { status: 400 });
    }
    try {
        await dbConnect();
        void Business;
        void Reward;
        void User;
        void Transaction;
        const redemptionQuery = {};
        if (businessId)
            redemptionQuery.businessId = businessId;
        if (status)
            redemptionQuery.status = status;
        if (from || to)
            redemptionQuery.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
        if (search) {
            const pattern = new RegExp(escapeRegex(search), "i");
            const [matchingRewards, matchingBusinesses, matchingUsers] = await Promise.all([
                Reward.find({ title: pattern }).select("_id").lean(),
                Business.find({ businessName: pattern }).select("_id").lean(),
                User.find({ $or: [{ name: pattern }, { email: pattern }] }).select("_id").lean(),
            ]);
            redemptionQuery.$or = [
                { redemptionCode: pattern },
                { rewardId: { $in: matchingRewards.map((item) => item._id) } },
                { businessId: { $in: matchingBusinesses.map((item) => item._id) } },
                { userId: { $in: matchingUsers.map((item) => item._id) } },
            ];
        }
        const skip = (page - 1) * limit;
        const [redemptions, totalCount, businesses] = await Promise.all([
            Redemption.find(redemptionQuery)
                .populate({ path: "rewardId", select: "title description coinCost status businessId" })
                .populate({ path: "businessId", select: "businessName verified suspended" })
                .populate({ path: "userId", select: "name email" })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Redemption.countDocuments(redemptionQuery),
            Business.find({}).select("businessName").sort({ businessName: 1 }).lean(),
        ]);
        const redemptionIds = redemptions.map((item) => item._id);
        const transactions = await Transaction.find({ type: "redeem", referenceId: { $in: redemptionIds } })
            .select("userId amount referenceId balanceAfter createdAt")
            .lean();
        const transactionMap = new Map();
        for (const transaction of transactions) {
            const referenceId = String(transaction.referenceId);
            const matches = transactionMap.get(referenceId) ?? [];
            matches.push(transaction);
            transactionMap.set(referenceId, matches);
        }
        return NextResponse.json({
            redemptions: redemptions.map((redemption) => {
                const reward = redemption.rewardId;
                const business = redemption.businessId;
                const user = redemption.userId;
                const matchingTransactions = transactionMap.get(String(redemption._id)) ?? [];
                const transaction = matchingTransactions.length === 1 ? matchingTransactions[0] : null;
                return {
                    id: String(redemption._id),
                    redemptionCode: redemption.redemptionCode,
                    coinsUsed: redemption.coinsUsed,
                    status: redemption.status,
                    createdAt: redemption.createdAt,
                    reward: reward ? { id: String(reward._id), title: reward.title, coinCost: reward.coinCost, status: reward.status } : null,
                    business: business ? { id: String(business._id), name: business.businessName, verified: business.verified, suspended: business.suspended } : null,
                    citizen: user ? { id: String(user._id), name: user.name, email: user.email } : null,
                    ledgerTransaction: transaction ? { id: String(transaction._id), amount: transaction.amount, balanceAfter: transaction.balanceAfter ?? null, createdAt: transaction.createdAt } : null,
                    audit: auditRedemption(redemption, matchingTransactions, reward, business),
                };
            }),
            businesses: businesses.map((business) => ({ id: String(business._id), name: business.businessName })),
            pagination: { currentPage: page, totalPages: Math.ceil(totalCount / limit) || 1, totalCount, limit },
        });
    }
    catch (error) {
        console.error("Failed to load admin redemption audit:", error);
        return NextResponse.json({ error: "Unable to retrieve redemption audit." }, { status: 500 });
    }
}
