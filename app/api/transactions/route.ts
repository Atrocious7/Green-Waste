import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Transaction from "@/models/Transaction";

export async function GET() {
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
    return NextResponse.json({ error: "Only citizens can view this transaction history." }, { status: 403 });
  }

  try {
    await dbConnect();
    const transactions = await Transaction.find({ userId: session.user.id })
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
  } catch {
    return NextResponse.json({ error: "Unable to load transaction history right now." }, { status: 500 });
  }
}