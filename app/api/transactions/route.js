import { NextResponse } from "next/server";
import { getAuthenticatedCitizen } from "@/lib/citizenAuth";
import dbConnect from "@/lib/db";
import Transaction from "@/models/Transaction";
export async function GET() {
    const auth = await getAuthenticatedCitizen("Only citizens can view this transaction history.");
    if (auth.errorResponse)
        return auth.errorResponse;
    try {
        await dbConnect();
        const transactions = await Transaction.find({ userId: auth.user.id })
            .select("type amount note referenceId balanceAfter createdAt")
            .sort({ createdAt: -1 })
            .lean();
        return NextResponse.json({
            transactions: transactions.map((transaction) => ({
                id: String(transaction._id),
                type: transaction.type,
                amount: transaction.amount,
                description: transaction.note ?? "",
                referenceId: transaction.referenceId ? String(transaction.referenceId) : null,
                balanceAfter: transaction.balanceAfter ?? null,
                createdAt: transaction.createdAt,
            })),
        });
    }
    catch {
        return NextResponse.json({ error: "Unable to load transaction history right now." }, { status: 500 });
    }
}
