"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import {
  Users,
  UserCheck,
  Building2,
  Trash2,
  CheckCircle2,
  Clock,
  Coins,
  Ticket,
  RefreshCw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** @typedef {{ totalUsers: number; totalCitizens: number; totalBusinesses: number; totalSubmissions: number; approvedSubmissions: number; pendingSubmissions: number; totalGreenCoins: number; totalRedemptions: number }} AdminStats */
/** @typedef {{ id: string; category: string; status: string; confidence: number; coinsAwarded: number; createdAt: string; user: { name: string; email: string } | null }} RecentSubmission */
/** @typedef {{ id: string; redemptionCode: string; coinsUsed: number; status: string; createdAt: string; reward: { title: string; coinCost: number } | null; user: { name: string; email: string } | null }} RecentRedemption */

/** @param {string|Date} value */
const formatDate = (value) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(/** @type {AdminStats|null} */ (null));
  const [recentSubmissions, setRecentSubmissions] = useState(/** @type {RecentSubmission[]} */ ([]));
  const [recentRedemptions, setRecentRedemptions] = useState(/** @type {RecentRedemption[]} */ ([]));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(/** @type {string|null} */ (null));

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/dashboard");
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("Access denied. Administrator privileges required.");
        }
        throw new Error("Failed to load admin statistics.");
      }
      const data = await res.json();
      setStats(data.stats);
      setRecentSubmissions(data.recentSubmissions || []);
      setRecentRedemptions(data.recentRedemptions || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const res = await fetch("/api/admin/dashboard");
        if (!isMounted) return;

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            throw new Error("Access denied. Administrator privileges required.");
          }
          throw new Error("Failed to load admin statistics.");
        }

        const data = await res.json();
        setStats(data.stats);
        setRecentSubmissions(data.recentSubmissions || []);
        setRecentRedemptions(data.recentRedemptions || []);
      } catch (err) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "An error occurred.";
          setError(msg);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  const statCards = [
    {
      label: "Total Registered Users",
      value: stats?.totalUsers ?? 0,
      icon: Users,
      accent: "text-blue-700 bg-blue-50 border-blue-100",
      description: "All accounts",
    },
    {
      label: "Citizens",
      value: stats?.totalCitizens ?? 0,
      icon: UserCheck,
      accent: "text-emerald-700 bg-emerald-50 border-emerald-100",
      description: "Active eco-citizens",
    },
    {
      label: "Partner Businesses",
      value: stats?.totalBusinesses ?? 0,
      icon: Building2,
      accent: "text-indigo-700 bg-indigo-50 border-indigo-100",
      description: "Reward providers",
    },
    {
      label: "Total Waste Submissions",
      value: stats?.totalSubmissions ?? 0,
      icon: Trash2,
      accent: "text-sky-700 bg-sky-50 border-sky-100",
      description: "Classified waste items",
    },
    {
      label: "Approved Submissions",
      value: stats?.approvedSubmissions ?? 0,
      icon: CheckCircle2,
      accent: "text-teal-700 bg-teal-50 border-teal-100",
      description: "Successfully processed",
    },
    {
      label: "Awaiting Review",
      value: stats?.pendingSubmissions ?? 0,
      icon: Clock,
      accent: "text-amber-700 bg-amber-50 border-amber-100",
      description: "Pending verification",
    },
    {
      label: "Green Coins Distributed",
      value: stats?.totalGreenCoins ?? 0,
      icon: Coins,
      accent: "text-emerald-700 bg-emerald-50 border-emerald-100",
      description: "User coin balances",
    },
    {
      label: "Total Redemptions",
      value: stats?.totalRedemptions ?? 0,
      icon: Ticket,
      accent: "text-purple-700 bg-purple-50 border-purple-100",
      description: "Claimed reward vouchers",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Top Header Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Platform Overview</h2>
          <p className="text-sm text-slate-500">Live operational metrics and recent activity across GreenSort.</p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="gap-1.5 text-slate-700"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Link
            href="/admin/users"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <Users className="h-4 w-4" />
            Manage Users
          </Link>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <p className="flex-1 font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchDashboardData} className="border-red-200 text-red-800">
            Retry
          </Button>
        </div>
      )}

      {/* Stats Grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {card.label}
                </span>
                <div className={`rounded-xl p-2.5 ${card.accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-slate-400" /> : card.value.toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{card.description}</p>
            </div>
          );
        })}
      </section>

      {/* Recent Activity Sections */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Recent Waste Submissions */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Recent Waste Submissions</h3>
              <p className="text-xs text-slate-500">Latest uploads submitted by citizens.</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          ) : recentSubmissions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <Trash2 className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm font-semibold text-slate-700">No submissions yet</p>
              <p className="mt-1 text-xs text-slate-500">Submitted waste items will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="pb-3 pr-3">User</th>
                    <th className="pb-3 pr-3">Category</th>
                    <th className="pb-3 pr-3">Coins</th>
                    <th className="pb-3 pr-3">Status</th>
                    <th className="pb-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentSubmissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/60">
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-slate-900">{sub.user?.name ?? "Unknown"}</p>
                        <p className="text-xs text-slate-400">{sub.user?.email}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="font-medium text-slate-800">{sub.category}</span>
                        <span className="ml-1 text-xs text-slate-400">({sub.confidence}%)</span>
                      </td>
                      <td className="py-3 pr-3 font-semibold text-emerald-700">+{sub.coinsAwarded}</td>
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                            sub.status === "approved" || sub.status === "awarded"
                              ? "bg-emerald-100 text-emerald-800"
                              : sub.status === "rejected"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-3 text-right text-xs text-slate-500">{formatDate(sub.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Recent Redemptions */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Recent Redemptions</h3>
              <p className="text-xs text-slate-500">Latest voucher claims by citizens.</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          ) : recentRedemptions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <Ticket className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm font-semibold text-slate-700">No redemptions yet</p>
              <p className="mt-1 text-xs text-slate-500">Redeemed reward vouchers will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="pb-3 pr-3">Voucher</th>
                    <th className="pb-3 pr-3">User</th>
                    <th className="pb-3 pr-3">Reward</th>
                    <th className="pb-3 pr-3">Coins</th>
                    <th className="pb-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentRedemptions.map((red) => (
                    <tr key={red.id} className="hover:bg-slate-50/60">
                      <td className="py-3 pr-3">
                        <span className="font-mono text-xs font-bold text-slate-800">{red.redemptionCode}</span>
                        <div className="mt-0.5">
                          <span
                            className={`inline-flex rounded-full px-1.5 py-0.2 text-[10px] font-semibold capitalize ${
                              red.status === "redeemed" || red.status === "completed"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {red.status}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-slate-900">{red.user?.name ?? "Unknown"}</p>
                        <p className="text-xs text-slate-400">{red.user?.email}</p>
                      </td>
                      <td className="py-3 pr-3 font-medium text-slate-800">
                        {red.reward?.title ?? "Unknown Reward"}
                      </td>
                      <td className="py-3 pr-3 font-semibold text-purple-700">{red.coinsUsed}</td>
                      <td className="py-3 text-right text-xs text-slate-500">{formatDate(red.createdAt)}</td>
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
