"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  Image as LucideImage,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SubmissionUser {
  id: string;
  name: string;
  email: string;
  greenCoins: number;
}

interface Submission {
  id: string;
  imageUrl: string;
  category: string;
  confidence: number;
  coinsAwarded: number;
  status: string;
  rewardProcessed: boolean;
  createdAt: string;
  updatedAt: string;
  user: SubmissionUser | null;
}

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
}

const formatDate = (value: string | Date) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

/**
 * Validates that a string is a valid absolute HTTP or HTTPS URL.
 * Returns true for valid absolute URLs (e.g., https://res.cloudinary.com/...),
 * false for relative paths, empty strings, or invalid URLs.
 */
function isValidImageUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "approved":
    case "awarded":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-3 w-3" />
          {status}
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
          <XCircle className="h-3 w-3" />
          {status}
        </span>
      );
    case "pending":
    case "needs_review":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
          <Clock className="h-3 w-3" />
          {status}
        </span>
      );
    default:
      return (
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
          {status}
        </span>
      );
  }
};

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 20,
  });

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeSearch, setActiveSearch] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Moderation Modal
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [moderationAction, setModerationAction] = useState<"approve" | "reject">("approve");
  const [moderationNote, setModerationNote] = useState<string>("");
  const [isModerating, setIsModerating] = useState<boolean>(false);

  const fetchSubmissions = useCallback(
    async (page = 1, search = activeSearch, status = selectedStatus, category = selectedCategory) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", page.toString());
        params.set("limit", "20");
        if (search) params.set("search", search);
        if (status) params.set("status", status);
        if (category) params.set("category", category);

        const res = await fetch(`/api/admin/submissions?${params.toString()}`);
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            throw new Error("Access denied. Administrator privileges required.");
          }
          throw new Error("Failed to load submission list.");
        }

        const data = await res.json();
        setSubmissions(data.submissions || []);
        setPagination(
          data.pagination || {
            currentPage: 1,
            totalPages: 1,
            totalCount: 0,
            limit: 20,
          }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unable to load submissions.";
        setError(msg);
        toast.error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [activeSearch, selectedStatus, selectedCategory]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadInitialSubmissions() {
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("limit", "20");
        if (activeSearch) params.set("search", activeSearch);
        if (selectedStatus) params.set("status", selectedStatus);
        if (selectedCategory) params.set("category", selectedCategory);

        const res = await fetch(`/api/admin/submissions?${params.toString()}`);
        if (!isMounted) return;

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            throw new Error("Access denied. Administrator privileges required.");
          }
          throw new Error("Failed to load submission list.");
        }

        const data = await res.json();
        setSubmissions(data.submissions || []);
        setPagination(
          data.pagination || {
            currentPage: 1,
            totalPages: 1,
            totalCount: 0,
            limit: 20,
          }
        );
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load submissions.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialSubmissions();

    return () => {
      isMounted = false;
    };
  }, [activeSearch, selectedStatus, selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery.trim());
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setActiveSearch("");
  };

  const openModerationModal = (submission: Submission, action: "approve" | "reject") => {
    setSelectedSubmission(submission);
    setModerationAction(action);
    setModerationNote("");
  };

  const handleModerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubmission) return;

    if (moderationAction === "reject" && !moderationNote.trim()) {
      toast.error("A rejection reason is required.");
      return;
    }

    setIsModerating(true);
    try {
      const res = await fetch(`/api/admin/submissions/${selectedSubmission.id}/moderate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: moderationAction,
          moderationNote: moderationNote.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to moderate submission.");
      }

      toast.success(data.message || `Submission ${moderationAction}d successfully!`);
      setSelectedSubmission(null);
      fetchSubmissions(pagination.currentPage, activeSearch, selectedStatus, selectedCategory);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to moderate submission.");
    } finally {
      setIsModerating(false);
    }
  };

  const categories = [
    "Plastic",
    "Paper",
    "Glass",
    "Metal",
    "Organic",
    "E-waste",
    "Non-recyclable",
    "pending",
  ];

  const statuses = [
    { value: "", label: "All Statuses" },
    { value: "pending", label: "Pending" },
    { value: "needs_review", label: "Needs Review" },
    { value: "approved", label: "Approved" },
    { value: "awarded", label: "Awarded" },
    { value: "rejected", label: "Rejected" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Submission Moderation</h2>
          <p className="text-sm text-slate-500">
            Review and moderate citizen waste submissions. Approve valid submissions to award Green Coins.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchSubmissions(pagination.currentPage, activeSearch, selectedStatus, selectedCategory)}
          disabled={isLoading}
          className="gap-1.5 self-start text-slate-700 sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh List
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <form onSubmit={handleSearchSubmit} className="relative flex flex-1 items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by citizen name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-12 text-slate-400 hover:text-slate-600"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
            <Button type="submit" size="sm" className="absolute right-1 bg-emerald-600 hover:bg-emerald-700">
              Search
            </Button>
          </form>

          {/* Status Filter */}
          <div className="w-full sm:w-44">
            <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value ?? "")}>
              <SelectTrigger className="h-9 text-sm w-full">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category Filter */}
          <div className="w-full sm:w-44">
            <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value ?? "")}>
              <SelectTrigger className="h-9 text-sm w-full">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <p className="flex-1 font-medium">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchSubmissions(pagination.currentPage, activeSearch, selectedStatus, selectedCategory)}
            className="border-red-200 text-red-800"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Submissions Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="mt-3 text-sm text-slate-500">Loading submissions...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-3 text-lg font-semibold text-slate-800">No submissions found</h3>
            <p className="mt-1 text-sm text-slate-500">
              {activeSearch || selectedStatus || selectedCategory
                ? "Try adjusting your search query or filters."
                : "No waste submissions exist yet."}
            </p>
            {(activeSearch || selectedStatus || selectedCategory) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setActiveSearch("");
                  setSelectedStatus("");
                  setSelectedCategory("");
                }}
                className="mt-4"
              >
                Clear all filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Image</th>
                  <th className="px-5 py-3.5">Citizen</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Confidence</th>
                  <th className="px-5 py-3.5">Coins</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-4">
                      {sub.imageUrl && isValidImageUrl(sub.imageUrl) ? (
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-slate-100">
                          <Image
                            src={sub.imageUrl}
                            alt={`Waste submission ${sub.category}`}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-slate-100 flex flex-col items-center justify-center gap-1">
                          <LucideImage className="h-6 w-6 text-slate-400" />
                          <span className="text-[10px] text-slate-500 text-center px-1">Image unavailable</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{sub.user?.name ?? "Unknown"}</p>
                      <p className="text-xs text-slate-500">{sub.user?.email}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                        {sub.category}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <Award className="h-3.5 w-3.5 text-sky-600" />
                        <span className="font-medium text-slate-800">{sub.confidence}%</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                        <Award className="h-4 w-4" />
                        <span>{sub.coinsAwarded}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      {getStatusBadge(sub.status)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                      {formatDate(sub.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openModerationModal(sub, "approve")}
                          disabled={
                            sub.status === "approved" ||
                            sub.status === "awarded" ||
                            sub.status === "rejected" ||
                            isModerating
                          }
                          className="gap-1.5 text-xs text-emerald-700 hover:bg-emerald-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openModerationModal(sub, "reject")}
                          disabled={
                            sub.status === "approved" ||
                            sub.status === "awarded" ||
                            sub.status === "rejected" ||
                            isModerating
                          }
                          className="gap-1.5 text-xs text-red-700 hover:bg-red-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openModerationModal(sub, "approve")}
                          disabled={isModerating}
                          className="text-slate-500 hover:text-slate-700"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {submissions.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-5 py-3 sm:flex-row">
            <p className="text-xs text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-800">
                {(pagination.currentPage - 1) * pagination.limit + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-slate-800">
                {Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)}
              </span>{" "}
              of <span className="font-semibold text-slate-800">{pagination.totalCount}</span> submissions
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchSubmissions(pagination.currentPage - 1, activeSearch, selectedStatus, selectedCategory)}
                disabled={pagination.currentPage <= 1 || isLoading}
                className="h-8 gap-1 px-2.5 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </Button>

              <span className="text-xs font-semibold text-slate-700">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchSubmissions(pagination.currentPage + 1, activeSearch, selectedStatus, selectedCategory)}
                disabled={pagination.currentPage >= pagination.totalPages || isLoading}
                className="h-8 gap-1 px-2.5 text-xs"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Moderation Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-700" />
                <h3 className="text-lg font-bold text-slate-900">
                  {moderationAction === "approve" ? "Approve Submission" : "Reject Submission"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedSubmission(null);
                  setModerationNote("");
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Submission Preview */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="md:col-span-1">
                    {selectedSubmission.imageUrl && isValidImageUrl(selectedSubmission.imageUrl) ? (
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-100">
                        <Image
                          src={selectedSubmission.imageUrl}
                          alt={`Waste submission ${selectedSubmission.category}`}
                          fill
                          className="object-cover"
                          sizes="100%"
                        />
                      </div>
                    ) : (
                      <div className="aspect-square rounded-lg bg-slate-100 flex flex-col items-center justify-center gap-2">
                        <LucideImage className="h-12 w-12 text-slate-400" />
                        <span className="text-xs text-slate-500 text-center px-2">Image unavailable</span>
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-slate-500">Citizen</p>
                        <p className="font-semibold text-slate-900">{selectedSubmission.user?.name ?? "Unknown"}</p>
                        <p className="text-xs text-slate-500">{selectedSubmission.user?.email}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Category / Confidence</p>
                        <p className="font-semibold text-slate-900">{selectedSubmission.category}</p>
                        <p className="text-xs text-sky-600">{selectedSubmission.confidence}% confidence</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Current Status</p>
                        <p>{getStatusBadge(selectedSubmission.status)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Coins to Award</p>
                        <p className="font-semibold text-emerald-700">{selectedSubmission.coinsAwarded}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Submitted</p>
                        <p className="font-semibold text-slate-900">{formatDate(selectedSubmission.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Reward Processed</p>
                        <p className="font-semibold text-slate-900">
                          {selectedSubmission.rewardProcessed ? "Yes" : "No"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Moderation Form */}
              <form onSubmit={handleModerate} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="moderation-note" className="text-sm font-semibold text-slate-900">
                    Moderation Note
                    {moderationAction === "reject" && <span className="text-red-600"> *</span>}
                  </Label>
                  <textarea
                    id="moderation-note"
                    rows={3}
                    value={moderationNote}
                    onChange={(e) => setModerationNote(e.target.value)}
                    placeholder={
                      moderationAction === "approve"
                        ? "Optional: Add a note about this approval..."
                        : "Required: Explain why this submission is being rejected..."
                    }
                    className="w-full rounded-md border border-slate-200 p-2 text-sm shadow-xs focus:border-emerald-500 focus:outline-hidden"
                    required={moderationAction === "reject"}
                  />
                  {moderationAction === "approve" && (
                    <p className="text-xs text-slate-500">
                      Optional. This note will be recorded with the submission.
                    </p>
                  )}
                  {moderationAction === "reject" && (
                    <p className="text-xs text-red-600">
                      Required. The citizen will see this reason.
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedSubmission(null);
                      setModerationNote("");
                    }}
                    disabled={isModerating}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isModerating || (moderationAction === "reject" && !moderationNote.trim())}
                    className={`gap-2 ${moderationAction === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
                  >
                    {isModerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      moderationAction === "approve"
                        ? "Approve & Award Coins"
                        : "Reject Submission"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}