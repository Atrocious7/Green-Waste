import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ArrowLeft, Coins, Leaf } from "lucide-react";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Transaction from "@/models/Transaction";

/** @param {Date|string} value */
const formatDate = (value) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

export default async function TransactionHistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");
  if (session.user.role !== "citizen") redirect("/");

  await dbConnect();
  const transactions = await Transaction.find({ userId: session.user.id })
    .select("type amount note balanceAfter createdAt")
    .sort({ createdAt: -1 })
    .lean();

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-5 sm:px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Leaf className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">GreenSort</p>
              <h1 className="text-xl font-semibold text-slate-900">Transaction history</h1>
            </div>
          </header>

          {transactions.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <Coins className="mx-auto h-8 w-8 text-emerald-600" />
              <h2 className="mt-3 font-semibold text-slate-900">No transactions yet</h2>
              <p className="mt-1 text-sm text-slate-500">Green Coin activity will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-5 py-3 font-medium sm:px-6">Date</th>
                    <th className="px-5 py-3 font-medium">Type / Description</th>
                    <th className="px-5 py-3 text-right font-medium">Amount</th>
                    <th className="px-5 py-3 text-right font-medium sm:px-6">Balance after</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={String(transaction._id)} className="border-b border-slate-100 last:border-0">
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600 sm:px-6">{formatDate(transaction.createdAt)}</td>
                      <td className="min-w-56 px-5 py-4">
                        <p className="font-medium capitalize text-slate-900">{transaction.type}</p>
                        <p className="mt-1 text-slate-500">{transaction.note ?? "Coin transaction"}</p>
                      </td>
                      <td className={`whitespace-nowrap px-5 py-4 text-right font-semibold ${transaction.amount > 0 ? "text-emerald-700" : "text-slate-700"}`}>
                        {transaction.amount > 0 ? "+" : ""}{transaction.amount}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right text-slate-700 sm:px-6">
                        {typeof transaction.balanceAfter === "number" ? transaction.balanceAfter : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
