"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Gift,
  Loader2,
  MapPin,
  Sparkles,
  Store,
  Ticket,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface RewardItem {
  id: string;
  title: string;
  description: string;
  coinCost: number;
  quantity: number;
  business: {
    id: string;
    name: string;
    address: string;
    description: string;
  } | null;
  createdAt: string;
}

interface VoucherItem {
  id: string;
  redemptionCode: string;
  coinsUsed: number;
  status: "pending" | "completed" | "cancelled" | "redeemed";
  createdAt: string;
  reward: {
    id: string;
    title: string;
    description: string;
    coinCost: number;
  } | null;
  business: {
    id: string;
    name: string;
    address: string;
  } | null;
}

interface NewRedemptionData {
  redemptionId: string;
  redemptionCode: string;
  rewardTitle: string;
  coinsUsed: number;
  balanceAfter: number;
  businessName: string;
}

const formatDate = (value: string | Date) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

export default function RewardsPage() {
  const [activeTab, setActiveTab] = useState<"catalog" | "vouchers">("catalog");
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [userCoins, setUserCoins] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [newRedemption, setNewRedemption] = useState<NewRedemptionData | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const refreshCatalogAndVouchers = useCallback(async () => {
    try {
      const [rewardsRes, vouchersRes] = await Promise.all([
        fetch("/api/rewards"),
        fetch("/api/redemptions"),
      ]);

      if (rewardsRes.ok) {
        const rewardsData = await rewardsRes.json();
        setRewards(rewardsData.rewards || []);
        setUserCoins(rewardsData.userCoins ?? 0);
      }

      if (vouchersRes.ok) {
        const vouchersData = await vouchersRes.json();
        setVouchers(vouchersData.redemptions || []);
      }
    } catch {
      toast.error("Unable to refresh rewards data.");
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    Promise.all([fetch("/api/rewards"), fetch("/api/redemptions")])
      .then(async ([rewardsRes, vouchersRes]) => {
        if (!isMounted) return;

        if (rewardsRes.ok) {
          const rewardsData = await rewardsRes.json();
          setRewards(rewardsData.rewards || []);
          setUserCoins(rewardsData.userCoins ?? 0);
        }

        if (vouchersRes.ok) {
          const vouchersData = await vouchersRes.json();
          setVouchers(vouchersData.redemptions || []);
        }
      })
      .catch(() => {
        if (isMounted) toast.error("Unable to load rewards data right now.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success("Voucher code copied to clipboard!");
      setTimeout(() => setCopiedCode(null), 3000);
    } catch {
      toast.error("Failed to copy code.");
    }
  };

  const handleRedeem = async (reward: RewardItem) => {
    if (userCoins < reward.coinCost) {
      toast.error(`Insufficient Green Coins. You need ${reward.coinCost - userCoins} more coins.`);
      return;
    }

    if (reward.quantity <= 0) {
      toast.error("This reward is currently out of stock.");
      return;
    }

    setRedeemingId(reward.id);

    try {
      const response = await fetch("/api/rewards/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardId: reward.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Redemption failed.");
      }

      toast.success(`Successfully redeemed ${reward.title}!`);
      setUserCoins(data.redemption.balanceAfter);
      setNewRedemption(data.redemption);

      // Refresh catalog and vouchers in background
      refreshCatalogAndVouchers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to complete redemption.";
      toast.error(msg);
    } finally {
      setRedeemingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Navigation & Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>

          <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-sm font-semibold text-emerald-800 shadow-sm sm:self-auto">
            <Coins className="h-4 w-4 text-emerald-600" />
            <span>{userCoins} Green Coins available</span>
          </div>
        </div>

        {/* Hero Section */}
        <header className="mb-8 rounded-2xl border border-emerald-100 bg-white/90 p-5 shadow-sm backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Gift className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">GreenSort</p>
                <h1 className="text-2xl font-bold text-slate-900">Rewards & Vouchers</h1>
                <p className="text-sm text-slate-500">Exchange your segregated waste Green Coins for real-world eco rewards.</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("catalog")}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  activeTab === "catalog"
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Gift className="h-4 w-4" />
                Browse Catalog
                <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                  {rewards.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("vouchers")}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  activeTab === "vouchers"
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Ticket className="h-4 w-4" />
                My Vouchers
                <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">
                  {vouchers.length}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Modal / Banner for Newly Generated Voucher */}
        {newRedemption && (
          <div className="relative mb-8 overflow-hidden rounded-2xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white shadow-lg">
            <button
              type="button"
              onClick={() => setNewRedemption(null)}
              className="absolute right-4 top-4 rounded-lg bg-black/10 p-1 text-white hover:bg-black/20"
              aria-label="Dismiss banner"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-100">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  Redemption Successful!
                </div>
                <h2 className="text-xl font-bold">{newRedemption.rewardTitle}</h2>
                <p className="text-sm text-emerald-100">
                  Spent {newRedemption.coinsUsed} Green Coins &bull; Present this code at{" "}
                  <strong className="underline underline-offset-2">{newRedemption.businessName}</strong>.
                </p>
              </div>

              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                <div className="rounded-xl border border-white/30 bg-black/20 px-4 py-2 font-mono text-xl font-black tracking-widest text-white shadow-inner">
                  {newRedemption.redemptionCode}
                </div>
                <Button
                  type="button"
                  onClick={() => handleCopyCode(newRedemption.redemptionCode)}
                  className="gap-2 bg-white text-emerald-800 hover:bg-emerald-50"
                >
                  {copiedCode === newRedemption.redemptionCode ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy Code
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setNewRedemption(null);
                    setActiveTab("vouchers");
                  }}
                  className="border-white/40 bg-transparent text-white hover:bg-white/10"
                >
                  View in My Vouchers
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-16 shadow-sm">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="mt-4 text-sm font-medium text-slate-600">Loading rewards...</p>
          </div>
        ) : activeTab === "catalog" ? (
          /* Tab 1: Rewards Catalog */
          rewards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
              <Gift className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-4 text-lg font-semibold text-slate-800">No active rewards available right now</h3>
              <p className="mt-1 text-sm text-slate-500">Check back soon for new partner offers and discounts.</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rewards.map((reward) => {
                const canAfford = userCoins >= reward.coinCost;
                const isOutOfStock = reward.quantity <= 0;
                const isRedeeming = redeemingId === reward.id;

                return (
                  <Card
                    key={reward.id}
                    className="flex flex-col justify-between overflow-hidden border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                  >
                    <CardHeader className="space-y-3 pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          <Store className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[150px]">{reward.business?.name ?? "Partner Store"}</span>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            isOutOfStock
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {isOutOfStock ? "Out of stock" : `${reward.quantity} left`}
                        </span>
                      </div>

                      <div>
                        <CardTitle className="text-lg font-bold text-slate-900">{reward.title}</CardTitle>
                        {reward.description ? (
                          <CardDescription className="mt-1 line-clamp-2 text-sm text-slate-500">
                            {reward.description}
                          </CardDescription>
                        ) : null}
                      </div>

                      {reward.business?.address ? (
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{reward.business.address}</span>
                        </div>
                      ) : null}
                    </CardHeader>

                    <CardContent className="pt-2">
                      <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-50 p-3">
                        <span className="text-xs font-medium text-slate-500">Price</span>
                        <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                          <Coins className="h-4 w-4" />
                          <span>{reward.coinCost} Coins</span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        onClick={() => handleRedeem(reward)}
                        disabled={!canAfford || isOutOfStock || isRedeeming}
                        className={`w-full gap-2 ${
                          canAfford && !isOutOfStock
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "bg-slate-100 text-slate-400 hover:bg-slate-100"
                        }`}
                      >
                        {isRedeeming ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Redeeming...
                          </>
                        ) : isOutOfStock ? (
                          "Out of stock"
                        ) : !canAfford ? (
                          `Need ${reward.coinCost - userCoins} more coins`
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            Redeem Reward
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )
        ) : (
          /* Tab 2: My Vouchers */
          vouchers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-14 text-center shadow-sm">
              <Ticket className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold text-slate-800">No vouchers redeemed yet</h3>
              <p className="mt-1 text-sm text-slate-500">
                You haven&apos;t claimed any rewards yet. Spend your Green Coins in the catalog!
              </p>
              <Button
                type="button"
                onClick={() => setActiveTab("catalog")}
                className="mt-5 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Gift className="h-4 w-4" />
                Browse Catalog
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {vouchers.map((voucher) => (
                <div
                  key={voucher.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900">{voucher.reward?.title ?? "Redeemed Reward"}</h3>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          voucher.status === "completed" || voucher.status === "redeemed"
                            ? "bg-green-100 text-green-800"
                            : voucher.status === "cancelled"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {voucher.status === "pending" ? (
                          <Clock className="h-3 w-3" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        {voucher.status}
                      </span>
                    </div>

                    <p className="text-sm text-slate-500">
                      Partner: <strong className="text-slate-700">{voucher.business?.name ?? "Partner Store"}</strong>
                      {voucher.business?.address ? ` &bull; ${voucher.business.address}` : ""}
                    </p>

                    <p className="text-xs text-slate-400">
                      Redeemed on {formatDate(voucher.createdAt)} &bull; Cost: {voucher.coinsUsed} Green Coins
                    </p>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-base font-bold tracking-wider text-slate-800">
                      {voucher.redemptionCode}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyCode(voucher.redemptionCode)}
                      className="gap-1.5"
                    >
                      {copiedCode === voucher.redemptionCode ? (
                        <>
                          <Check className="h-4 w-4 text-emerald-600" />
                          <span className="text-xs">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 text-slate-600" />
                          <span className="text-xs">Copy</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
