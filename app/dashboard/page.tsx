import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, Coins, Clock3, Gift, Leaf, Plus, Trash2 } from "lucide-react";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { DashboardLogoutButton } from "@/components/dashboard-logout";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import WasteSubmission from "@/models/WasteSubmission";

const formatDate = (value: Date | string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const userRole = session.user.role;
  if (userRole !== "citizen") {
    redirect("/");
  }

  await dbConnect();

  const [currentUser, totalSubmissions, approvedSubmissions, pendingSubmissions, recentSubmissions] =
    await Promise.all([
      User.findById(session.user.id).lean(),
      WasteSubmission.countDocuments({ userId: session.user.id }),
      WasteSubmission.countDocuments({ userId: session.user.id, status: { $in: ["approved", "awarded"] } }),
      WasteSubmission.countDocuments({
        userId: session.user.id,
        status: { $in: ["pending", "needs_review"] },
      }),
      WasteSubmission.find({ userId: session.user.id }).sort({ createdAt: -1 }).limit(5).lean(),
    ]);

  const user = currentUser as { name?: string; greenCoins?: number } | null;

  const stats = [
    {
      label: "Green Coins",
      value: user?.greenCoins ?? 0,
      icon: Coins,
      accent: "text-emerald-600",
    },
    {
      label: "Total Waste",
      value: totalSubmissions,
      icon: Trash2,
      accent: "text-sky-600",
    },
    {
      label: "Approved",
      value: approvedSubmissions,
      icon: CheckCircle2,
      accent: "text-green-600",
    },
    {
      label: "Pending / Review",
      value: pendingSubmissions,
      icon: Clock3,
      accent: "text-amber-600",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-2xl border border-emerald-100 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Leaf className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">GreenSort</p>
                <h1 className="text-xl font-semibold text-slate-900">Welcome, {user?.name ?? "Citizen"}</h1>
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
                <Coins className="h-4 w-4" />
                {user?.greenCoins ?? 0} Green Coins
              </div>
              <DashboardLogoutButton />
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ label, value, icon: Icon, accent }) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{label}</p>
                <div className={`rounded-lg bg-slate-100 p-2 ${accent}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 text-3xl font-bold text-slate-900">{value}</div>
            </div>
          ))}
        </section>

        <div className="mt-8 flex justify-start">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/submit"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-base font-medium text-white shadow-sm transition hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Submit Waste
            </Link>
            <Link
              href="/dashboard/rewards"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-base font-medium text-emerald-800 shadow-sm transition hover:bg-emerald-100"
            >
              <Gift className="h-4 w-4" />
              Rewards & Vouchers
            </Link>
            <Link
              href="/dashboard/transactions"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-base font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Coins className="h-4 w-4" />
              Transaction history
            </Link>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Recent submissions</h2>
              <p className="text-sm text-slate-500">Your latest waste activity.</p>
            </div>
            <Link href="/dashboard/submit" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800">
              New upload
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {recentSubmissions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Leaf className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">No submissions yet</h3>
              <p className="mt-2 text-sm text-slate-600">
                Your submitted waste will show up here once you upload your first item for review.
              </p>
              <Link
                href="/dashboard/submit"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                Upload waste
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="pb-3 pr-4 font-medium">Category</th>
                    <th className="pb-3 pr-4 font-medium">Confidence</th>
                    <th className="pb-3 pr-4 font-medium">Coins</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSubmissions.map((submission) => (
                    <tr key={String(submission._id)} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pr-4 font-medium text-slate-800">{submission.category ?? "pending"}</td>
                      <td className="py-3 pr-4 text-slate-700">{submission.confidence ?? 0}%</td>
                      <td className="py-3 pr-4 text-slate-700">{submission.coinsAwarded ?? 0}</td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                          {submission.status ?? "pending"}
                        </span>
                      </td>
                      <td className="py-3 text-slate-700">{formatDate(submission.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
