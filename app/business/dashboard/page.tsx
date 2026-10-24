"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Edit2,
  Gift,
  History,
  Loader2,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Store,
  Ticket,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardLogoutButton } from "@/components/dashboard-logout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BusinessProfile {
  id: string;
  businessName: string;
  email: string;
  address: string;
  description: string;
  verified: boolean;
  createdAt: string;
}

interface DashboardStats {
  activeRewardsCount: number;
  totalRewardsCount: number;
  totalAvailableStock: number;
  redeemedCount: number;
  pendingCount: number;
  totalCoinsClaimed: number;
}

interface BusinessReward {
  id: string;
  title: string;
  description: string;
  coinCost: number;
  quantity: number;
  status: "active" | "inactive" | "deleted";
  totalRedemptions: number;
  completedRedemptions: number;
  createdAt: string;
  updatedAt: string;
}

interface BusinessRedemption {
  id: string;
  redemptionCode: string;
  coinsUsed: number;
  status: "pending" | "completed" | "cancelled" | "redeemed";
  createdAt: string;
  updatedAt?: string;
  reward: {
    id: string;
    title: string;
    description: string;
    coinCost: number;
    status?: string;
  } | null;
  customer: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface VerifiedVoucherResult {
  id: string;
  redemptionCode: string;
  status: string;
  coinsUsed: number;
  redeemedAt: string;
  reward: {
    title: string;
    coinCost: number;
  } | null;
  customer: {
    name: string;
    email: string;
  } | null;
}

const formatDate = (value: string | Date) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export default function BusinessDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"rewards" | "redemptions" | "profile">("rewards");

  // Core data states
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [rewards, setRewards] = useState<BusinessReward[]>([]);
  const [redemptions, setRedemptions] = useState<BusinessRedemption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Voucher verification state
  const [voucherCodeInput, setVoucherCodeInput] = useState<string>("");
  const [isVerifyingVoucher, setIsVerifyingVoucher] = useState<boolean>(false);
  const [voucherSuccessResult, setVoucherSuccessResult] = useState<VerifiedVoucherResult | null>(null);
  const [voucherError, setVoucherError] = useState<string>("");

  // Create Reward modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createTitle, setCreateTitle] = useState<string>("");
  const [createDescription, setCreateDescription] = useState<string>("");
  const [createCoinCost, setCreateCoinCost] = useState<string>("200");
  const [createQuantity, setCreateQuantity] = useState<string>("50");
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);

  // Edit Reward modal state
  const [editingReward, setEditingReward] = useState<BusinessReward | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editCoinCost, setEditCoinCost] = useState<string>("");
  const [editQuantity, setEditQuantity] = useState<string>("");
  const [editStatus, setEditStatus] = useState<"active" | "inactive">("active");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  // Profile form state
  const [profileName, setProfileName] = useState<string>("");
  const [profileEmail, setProfileEmail] = useState<string>("");
  const [profileAddress, setProfileAddress] = useState<string>("");
  const [profileDescription, setProfileDescription] = useState<string>("");
  const [isSubmittingProfile, setIsSubmittingProfile] = useState<boolean>(false);

  // Clipboard copy state
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    let isMounted = true;

    Promise.all([
      fetch("/api/business/dashboard"),
      fetch("/api/business/rewards"),
      fetch("/api/business/redemptions"),
    ])
      .then(async ([dashRes, rewardsRes, redemptionsRes]) => {
        if (!isMounted) return;

        if (dashRes.ok) {
          const dashData = await dashRes.json();
          setBusiness(dashData.business);
          setStats(dashData.stats);
          setProfileName(dashData.business?.businessName ?? "");
          setProfileEmail(dashData.business?.email ?? "");
          setProfileAddress(dashData.business?.address ?? "");
          setProfileDescription(dashData.business?.description ?? "");
        } else if (dashRes.status === 403 || dashRes.status === 401) {
          router.push("/auth/login");
          return;
        }

        if (rewardsRes.ok) {
          const rewardsData = await rewardsRes.json();
          setRewards(rewardsData.rewards || []);
        }

        if (redemptionsRes.ok) {
          const redData = await redemptionsRes.json();
          setRedemptions(redData.redemptions || []);
        }
      })
      .catch(() => {
        if (isMounted) toast.error("Unable to load business dashboard data.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  const refreshDashboardData = async () => {
    try {
      const [dashRes, rewardsRes, redemptionsRes] = await Promise.all([
        fetch("/api/business/dashboard"),
        fetch("/api/business/rewards"),
        fetch("/api/business/redemptions"),
      ]);

      if (dashRes.ok) {
        const dashData = await dashRes.json();
        setBusiness(dashData.business);
        setStats(dashData.stats);
      }
      if (rewardsRes.ok) {
        const rewardsData = await rewardsRes.json();
        setRewards(rewardsData.rewards || []);
      }
      if (redemptionsRes.ok) {
        const redData = await redemptionsRes.json();
        setRedemptions(redData.redemptions || []);
      }
    } catch {
      toast.error("Failed to refresh data.");
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success("Code copied!");
      setTimeout(() => setCopiedCode(null), 3000);
    } catch {
      toast.error("Failed to copy code.");
    }
  };

  // 1. Voucher Redemption / Verification Handler
  const handleRedeemVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setVoucherError("");
    setVoucherSuccessResult(null);

    const code = voucherCodeInput.trim().toUpperCase();
    if (!code) {
      setVoucherError("Please enter a voucher code.");
      return;
    }

    setIsVerifyingVoucher(true);

    try {
      const res = await fetch("/api/business/vouchers/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redemptionCode: code }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Unable to redeem voucher.");
      }

      toast.success(data.message || "Voucher redeemed successfully!");
      setVoucherSuccessResult(data.voucher);
      setVoucherCodeInput("");
      refreshDashboardData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Voucher verification failed.";
      setVoucherError(message);
      toast.error(message);
    } finally {
      setIsVerifyingVoucher(false);
    }
  };

  // 2. Create Reward Handler
  const handleCreateReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) {
      toast.error("Reward title is required.");
      return;
    }

    const coinCost = parseInt(createCoinCost, 10);
    const quantity = parseInt(createQuantity, 10);

    if (isNaN(coinCost) || coinCost < 1) {
      toast.error("Coin cost must be at least 1.");
      return;
    }

    if (isNaN(quantity) || quantity < 0) {
      toast.error("Stock quantity must be 0 or more.");
      return;
    }

    setIsSubmittingCreate(true);

    try {
      const res = await fetch("/api/business/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createTitle.trim(),
          description: createDescription.trim(),
          coinCost,
          quantity,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to create reward.");
      }

      toast.success("Reward created successfully!");
      setIsCreateModalOpen(false);
      setCreateTitle("");
      setCreateDescription("");
      setCreateCoinCost("200");
      setCreateQuantity("50");
      refreshDashboardData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create reward.");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // 3. Edit Reward Handler
  const openEditModal = (reward: BusinessReward) => {
    setEditingReward(reward);
    setEditTitle(reward.title);
    setEditDescription(reward.description || "");
    setEditCoinCost(String(reward.coinCost));
    setEditQuantity(String(reward.quantity));
    setEditStatus(reward.status === "inactive" ? "inactive" : "active");
  };

  const handleUpdateReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReward) return;

    if (!editTitle.trim()) {
      toast.error("Reward title cannot be empty.");
      return;
    }

    const coinCost = parseInt(editCoinCost, 10);
    const quantity = parseInt(editQuantity, 10);

    if (isNaN(coinCost) || coinCost < 1) {
      toast.error("Coin cost must be at least 1.");
      return;
    }

    if (isNaN(quantity) || quantity < 0) {
      toast.error("Stock quantity must be 0 or more.");
      return;
    }

    setIsSubmittingEdit(true);

    try {
      const res = await fetch(`/api/business/rewards/${editingReward.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          coinCost,
          quantity,
          status: editStatus,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to update reward.");
      }

      toast.success("Reward updated successfully!");
      setEditingReward(null);
      refreshDashboardData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update reward.");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // 4. Quick Toggle Status (Activate / Deactivate)
  const handleToggleStatus = async (reward: BusinessReward) => {
    const nextStatus = reward.status === "active" ? "inactive" : "active";
    try {
      const res = await fetch(`/api/business/rewards/${reward.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "Failed to change status.");
      }

      toast.success(`Reward is now ${nextStatus}.`);
      refreshDashboardData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change status.");
    }
  };

  // 5. Delete Reward Handler (Soft delete)
  const handleDeleteReward = async (reward: BusinessReward) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${reward.title}"? Existing customer redemptions will be preserved, but it will be removed from the catalog.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/business/rewards/${reward.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "Failed to delete reward.");
      }

      toast.success("Reward deleted successfully.");
      refreshDashboardData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete reward.");
    }
  };

  // 6. Update Profile Handler
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      toast.error("Business name cannot be empty.");
      return;
    }

    setIsSubmittingProfile(true);

    try {
      const res = await fetch("/api/business/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: profileName.trim(),
          email: profileEmail.trim(),
          address: profileAddress.trim(),
          description: profileDescription.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to update profile.");
      }

      toast.success("Business profile updated!");
      setBusiness(data.business);
      refreshDashboardData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Top Header */}
        <header className="rounded-2xl border border-emerald-100 bg-white/95 p-5 shadow-sm backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Store className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">GreenSort Partner</p>
                  {business?.verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified Partner
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      Partner Store
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-bold text-slate-900">{business?.businessName ?? "Business Dashboard"}</h1>
                {business?.address ? (
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="h-3 w-3" />
                    {business.address}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshDashboardData}
                className="gap-1.5 text-slate-600"
                title="Refresh dashboard data"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <DashboardLogoutButton />
            </div>
          </div>
        </header>

        {/* Summary Stats Grid */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Active Rewards</p>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                <Gift className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-bold text-slate-900">
              {stats?.activeRewardsCount ?? 0}
              <span className="ml-1 text-sm font-normal text-slate-400">/ {stats?.totalRewardsCount ?? 0} total</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Available Stock</p>
              <div className="rounded-lg bg-sky-50 p-2 text-sky-700">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-bold text-slate-900">
              {stats?.totalAvailableStock ?? 0}
              <span className="ml-1 text-sm font-normal text-slate-400">units in circulation</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Vouchers Redeemed</p>
              <div className="rounded-lg bg-teal-50 p-2 text-teal-700">
                <Ticket className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-bold text-slate-900">
              {stats?.redeemedCount ?? 0}
              <span className="ml-1 text-sm font-normal text-slate-400">
                ({stats?.pendingCount ?? 0} pending)
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Coins Claimed</p>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-700">
                <Coins className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-bold text-emerald-800">
              {stats?.totalCoinsClaimed ?? 0}
              <span className="ml-1 text-sm font-normal text-slate-400">Green Coins</span>
            </div>
          </div>
        </section>

        {/* Voucher Validation Card (Goal 5: Validate voucher codes & mark redeemed atomically) */}
        <Card className="overflow-hidden border-2 border-emerald-500/30 bg-gradient-to-r from-emerald-50/50 via-white to-teal-50/50 shadow-md">
          <CardHeader className="border-b border-emerald-100/70 pb-4">
            <div className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-lg font-bold text-slate-900">Customer Voucher Verification & Redemption</CardTitle>
            </div>
            <CardDescription className="text-sm text-slate-600">
              When a citizen presents a GreenSort voucher code at your counter, enter it here to instantly validate and mark it as redeemed.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={handleRedeemVoucher} className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder="e.g. GS-172927-9F3A"
                  value={voucherCodeInput}
                  onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
                  className="h-12 font-mono text-base font-semibold tracking-wider uppercase sm:text-lg"
                  disabled={isVerifyingVoucher}
                />
              </div>

              <Button
                type="submit"
                disabled={isVerifyingVoucher || !voucherCodeInput.trim()}
                className="h-12 gap-2 bg-emerald-600 px-6 font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                {isVerifyingVoucher ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Validate & Redeem
                  </>
                )}
              </Button>
            </form>

            {/* Error Feedback */}
            {voucherError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                <span>{voucherError}</span>
              </div>
            )}

            {/* Success Feedback Card */}
            {voucherSuccessResult && (
              <div className="mt-4 rounded-xl border-2 border-emerald-500 bg-emerald-50 p-5 shadow-sm">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-200/80 px-2.5 py-0.5 text-xs font-bold text-emerald-900">
                      <Check className="h-3.5 w-3.5" />
                      VOUCHER REDEEMED
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {voucherSuccessResult.reward?.title ?? "Reward Item"}
                    </h3>
                    <p className="text-sm text-slate-600">
                      Citizen: <strong>{voucherSuccessResult.customer?.name}</strong> ({voucherSuccessResult.customer?.email})
                    </p>
                    <p className="text-xs text-slate-500">
                      Coins Used: {voucherSuccessResult.coinsUsed} &bull; Code:{" "}
                      <span className="font-mono font-bold text-slate-800">{voucherSuccessResult.redemptionCode}</span> &bull;{" "}
                      Redeemed on {formatDate(voucherSuccessResult.redeemedAt)}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setVoucherSuccessResult(null)}
                    className="self-start sm:self-auto"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab("rewards")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "rewards"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Gift className="h-4 w-4" />
            Manage Rewards ({rewards.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("redemptions")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "redemptions"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <History className="h-4 w-4" />
            Redemption History ({redemptions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "profile"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Store Profile
          </button>
        </div>

        {/* Tab 1: Rewards Management */}
        {activeTab === "rewards" && (
          <section className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Your Rewards</h2>
                <p className="text-sm text-slate-500">Create and manage items available for citizen Green Coin redemption.</p>
              </div>

              <Button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                Add New Reward
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              </div>
            ) : rewards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
                <Gift className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-3 text-lg font-semibold text-slate-800">No rewards created yet</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Offer discounts, drinks, or products to eco-friendly citizens who segregate waste.
                </p>
                <Button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-4 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                  Create Your First Reward
                </Button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                        <th className="px-5 py-3 font-semibold">Title & Description</th>
                        <th className="px-5 py-3 font-semibold">Cost</th>
                        <th className="px-5 py-3 font-semibold">Stock</th>
                        <th className="px-5 py-3 font-semibold">Redeemed</th>
                        <th className="px-5 py-3 font-semibold">Status</th>
                        <th className="px-5 py-3 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rewards.map((r) => (
                        <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                          <td className="px-5 py-4">
                            <p className="font-bold text-slate-900">{r.title}</p>
                            {r.description ? (
                              <p className="line-clamp-1 text-xs text-slate-500">{r.description}</p>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 font-semibold text-emerald-800">
                            {r.coinCost} Coins
                          </td>
                          <td className="whitespace-nowrap px-5 py-4">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                r.quantity === 0
                                  ? "bg-red-100 text-red-700"
                                  : r.quantity < 10
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {r.quantity} available
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                            {r.completedRedemptions} redeemed
                          </td>
                          <td className="whitespace-nowrap px-5 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${
                                r.status === "active"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleStatus(r)}
                                className="h-8 text-xs text-slate-700"
                              >
                                {r.status === "active" ? "Deactivate" : "Activate"}
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openEditModal(r)}
                                className="h-8 gap-1 text-xs text-slate-700"
                              >
                                <Edit2 className="h-3 w-3" />
                                Edit
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteReward(r)}
                                className="h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Tab 2: Redemption History */}
        {activeTab === "redemptions" && (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Customer Redemptions</h2>
              <p className="text-sm text-slate-500">Audit trail of all vouchers claimed for your rewards.</p>
            </div>

            {isLoading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              </div>
            ) : redemptions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
                <History className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-3 text-lg font-semibold text-slate-800">No redemptions yet</h3>
                <p className="mt-1 text-sm text-slate-500">
                  When citizens redeem rewards with their Green Coins, their vouchers will show up here.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                        <th className="px-5 py-3 font-semibold">Voucher Code</th>
                        <th className="px-5 py-3 font-semibold">Reward</th>
                        <th className="px-5 py-3 font-semibold">Customer</th>
                        <th className="px-5 py-3 font-semibold">Coins</th>
                        <th className="px-5 py-3 font-semibold">Status</th>
                        <th className="px-5 py-3 font-semibold">Date Claimed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {redemptions.map((red) => (
                        <tr key={red.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                          <td className="whitespace-nowrap px-5 py-4">
                            <div className="flex items-center gap-2">
                              <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-bold text-slate-800">
                                {red.redemptionCode}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyCode(red.redemptionCode)}
                                className="text-slate-400 hover:text-slate-600"
                                title="Copy code"
                              >
                                {copiedCode === red.redemptionCode ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </td>

                          <td className="px-5 py-4 font-semibold text-slate-900">
                            {red.reward?.title ?? "Reward Item"}
                          </td>

                          <td className="px-5 py-4">
                            <p className="font-medium text-slate-800">{red.customer?.name ?? "Citizen"}</p>
                            {red.customer?.email ? (
                              <p className="text-xs text-slate-400">{red.customer.email}</p>
                            ) : null}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 font-bold text-emerald-800">
                            {red.coinsUsed}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                                red.status === "redeemed" || red.status === "completed"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : red.status === "cancelled"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {red.status === "pending" ? (
                                <Clock className="h-3 w-3" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                              {red.status}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                            {formatDate(red.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Tab 3: Store Profile */}
        {activeTab === "profile" && (
          <section className="max-w-2xl">
            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-slate-900">Partner Store Profile</CardTitle>
                <CardDescription>
                  Update the business details that citizens see in the rewards catalog.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-name">Business Name</Label>
                    <Input
                      id="biz-name"
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="biz-email">Contact Email</Label>
                    <Input
                      id="biz-email"
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="biz-addr">Store Address</Label>
                    <Input
                      id="biz-addr"
                      type="text"
                      placeholder="e.g. 123 Eco St, Green City"
                      value={profileAddress}
                      onChange={(e) => setProfileAddress(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="biz-desc">Store Description</Label>
                    <textarea
                      id="biz-desc"
                      rows={3}
                      value={profileDescription}
                      onChange={(e) => setProfileDescription(e.target.value)}
                      className="w-full rounded-md border border-slate-200 p-2.5 text-sm shadow-xs focus:border-emerald-500 focus:outline-hidden"
                      placeholder="Tell citizens about your business and your eco-friendly offerings..."
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmittingProfile}
                    className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    {isSubmittingProfile ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving Changes...
                      </>
                    ) : (
                      "Save Profile Changes"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>
        )}
      </div>

      {/* Create Reward Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Add New Reward</h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReward} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="create-title">Reward Title *</Label>
                <Input
                  id="create-title"
                  type="text"
                  placeholder="e.g. 20% Off Eco Smoothies"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-desc">Description</Label>
                <textarea
                  id="create-desc"
                  rows={2}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Redeem for 20% discount on any fresh smoothie..."
                  className="w-full rounded-md border border-slate-200 p-2 text-sm shadow-xs focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="create-cost">Cost (Green Coins) *</Label>
                  <Input
                    id="create-cost"
                    type="number"
                    min="1"
                    value={createCoinCost}
                    onChange={(e) => setCreateCoinCost(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="create-qty">Initial Stock Units *</Label>
                  <Input
                    id="create-qty"
                    type="number"
                    min="0"
                    value={createQuantity}
                    onChange={(e) => setCreateQuantity(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmittingCreate}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {isSubmittingCreate ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Reward"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Reward Modal */}
      {editingReward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Edit Reward</h3>
              <button
                type="button"
                onClick={() => setEditingReward(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateReward} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-title">Reward Title *</Label>
                <Input
                  id="edit-title"
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-desc">Description</Label>
                <textarea
                  id="edit-desc"
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full rounded-md border border-slate-200 p-2 text-sm shadow-xs focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-cost">Cost (Green Coins) *</Label>
                  <Input
                    id="edit-cost"
                    type="number"
                    min="1"
                    value={editCoinCost}
                    onChange={(e) => setEditCoinCost(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-qty">Available Stock *</Label>
                  <Input
                    id="edit-qty"
                    type="number"
                    min="0"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-status">Status</Label>
                <select
                  id="edit-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as "active" | "inactive")}
                  className="w-full rounded-md border border-slate-200 p-2 text-sm shadow-xs focus:border-emerald-500 focus:outline-hidden"
                >
                  <option value="active">Active (Visible in citizen catalog)</option>
                  <option value="inactive">Inactive (Hidden from catalog)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingReward(null)}
                  disabled={isSubmittingEdit}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {isSubmittingEdit ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
