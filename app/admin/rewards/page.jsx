"use client";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Gift, Loader2, RefreshCw, Search, Trash2, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
const formatDate = (value) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
export default function AdminRewardsPage() {
    const [rewards, setRewards] = useState([]);
    const [businesses, setBusinesses] = useState([]);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0, limit: 10 });
    const [search, setSearch] = useState("");
    const [activeSearch, setActiveSearch] = useState("");
    const [businessId, setBusinessId] = useState("all");
    const [status, setStatus] = useState("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selected, setSelected] = useState(null);
    const loadRewards = useCallback(async (page = 1) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "10" });
            if (activeSearch)
                params.set("search", activeSearch);
            if (businessId !== "all")
                params.set("businessId", businessId);
            if (status !== "all")
                params.set("status", status);
            const response = await fetch(`/api/admin/rewards?${params.toString()}`);
            const data = await response.json().catch(() => ({}));
            if (!response.ok)
                throw new Error(data.error || "Unable to load rewards.");
            setRewards(data.rewards ?? []);
            setBusinesses(data.businesses ?? []);
            setPagination(data.pagination ?? { currentPage: 1, totalPages: 1, totalCount: 0, limit: 10 });
        }
        catch (loadError) {
            const message = loadError instanceof Error ? loadError.message : "Unable to load rewards.";
            setError(message);
            toast.error(message);
        }
        finally {
            setLoading(false);
        }
    }, [activeSearch, businessId, status]);
    useEffect(() => {
        const task = window.setTimeout(() => void loadRewards(1), 0);
        return () => window.clearTimeout(task);
    }, [loadRewards]);
    const updateStatus = async (reward, nextStatus) => {
        if (!window.confirm(`${nextStatus === "inactive" ? "Deactivate" : "Reactivate"} ${reward.title}?`))
            return;
        try {
            const response = await fetch(`/api/admin/rewards/${reward.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: nextStatus }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok)
                throw new Error(data.error || "Unable to update reward.");
            toast.success("Reward status updated.");
            setSelected(null);
            await loadRewards(pagination.currentPage);
        }
        catch (updateError) {
            toast.error(updateError instanceof Error ? updateError.message : "Unable to update reward.");
        }
    };
    const deleteReward = async (reward) => {
        if (!window.confirm(`Soft-delete ${reward.title}? Existing redemptions will be preserved.`))
            return;
        try {
            const response = await fetch(`/api/admin/rewards/${reward.id}`, { method: "DELETE" });
            const data = await response.json().catch(() => ({}));
            if (!response.ok)
                throw new Error(data.error || "Unable to delete reward.");
            toast.success("Reward soft-deleted.");
            setSelected(null);
            await loadRewards(pagination.currentPage);
        }
        catch (deleteError) {
            toast.error(deleteError instanceof Error ? deleteError.message : "Unable to delete reward.");
        }
    };
    return (<div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Reward Governance</h2>
          <p className="text-sm text-slate-500">Review and control rewards offered by partner businesses.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadRewards(pagination.currentPage)} disabled={loading} className="gap-2 self-start">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}/> Refresh
        </Button>
      </header>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row">
        <form className="relative flex-1" onSubmit={(event) => { event.preventDefault(); setActiveSearch(search.trim()); }}>
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reward title or business" className="pl-9"/>
        </form>
        <Select value={businessId} onValueChange={(value) => setBusinessId(value ?? "all")}>
          <SelectTrigger className="w-full lg:w-56"><SelectValue placeholder="All businesses"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All businesses</SelectItem>
            {businesses.map((business) => <SelectItem key={business.id} value={business.id}>{business.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(value) => setStatus(value ?? "all")}>
          <SelectTrigger className="w-full lg:w-44"><SelectValue placeholder="All statuses"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="deleted">Deleted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{error}</span><Button variant="outline" size="sm" onClick={() => loadRewards(pagination.currentPage)}>Retry</Button></div>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (<div className="flex flex-col items-center justify-center p-16"><Loader2 className="h-8 w-8 animate-spin text-emerald-600"/><p className="mt-3 text-sm text-slate-500">Loading rewards...</p></div>) : rewards.length === 0 ? (<div className="p-16 text-center"><Gift className="mx-auto h-10 w-10 text-slate-300"/><h3 className="mt-3 font-semibold text-slate-800">No rewards found</h3><p className="mt-1 text-sm text-slate-500">Try a different search or filter.</p></div>) : (<div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead><tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><th className="px-5 py-3">Reward</th><th className="px-5 py-3">Business</th><th className="px-5 py-3">Cost</th><th className="px-5 py-3">Stock</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rewards.map((reward) => <tr key={reward.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4"><p className="font-semibold text-slate-900">{reward.title}</p><p className="max-w-xs truncate text-xs text-slate-500">{reward.description || "No description"}</p></td>
                  <td className="px-5 py-4"><p className="font-medium text-slate-800">{reward.business?.name ?? "Unknown business"}</p><p className="text-xs text-slate-500">{reward.business?.verified ? "Verified" : "Unverified"}{reward.business?.suspended ? " · Suspended" : ""}</p></td>
                  <td className="px-5 py-4 text-slate-700">{reward.coinCost}</td>
                  <td className="px-5 py-4 text-slate-700">{reward.quantity}</td>
                  <td className="px-5 py-4"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${reward.status === "active" ? "bg-emerald-100 text-emerald-800" : reward.status === "inactive" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-700"}`}>{reward.status === "active" ? <CheckCircle2 className="h-3 w-3"/> : <XCircle className="h-3 w-3"/>}{reward.status}</span></td>
                  <td className="px-5 py-4 text-right"><Button variant="outline" size="sm" onClick={() => setSelected(reward)}>Details</Button></td>
                </tr>)}
              </tbody>
            </table>
          </div>)}
        {!loading && rewards.length > 0 && <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/60 px-5 py-3 text-xs text-slate-600"><span>{pagination.totalCount} rewards · page {pagination.currentPage} of {pagination.totalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={pagination.currentPage <= 1} onClick={() => loadRewards(pagination.currentPage - 1)}><ChevronLeft className="h-4 w-4"/></Button><Button variant="outline" size="sm" disabled={pagination.currentPage >= pagination.totalPages} onClick={() => loadRewards(pagination.currentPage + 1)}><ChevronRight className="h-4 w-4"/></Button></div></div>}
      </section>

      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Reward details</p><h3 className="mt-1 text-xl font-bold text-slate-900">{selected.title}</h3></div><button type="button" onClick={() => setSelected(null)} aria-label="Close"><X className="h-5 w-5 text-slate-500"/></button></div><dl className="mt-5 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-slate-500">Business</dt><dd className="font-medium">{selected.business?.name ?? "Unknown"}</dd></div><div><dt className="text-slate-500">Created</dt><dd className="font-medium">{formatDate(selected.createdAt)}</dd></div><div><dt className="text-slate-500">Coin cost</dt><dd className="font-medium">{selected.coinCost}</dd></div><div><dt className="text-slate-500">Stock</dt><dd className="font-medium">{selected.quantity}</dd></div></dl><p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{selected.description || "No description provided."}</p><div className="mt-6 flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setSelected(null)}>Close</Button>{selected.status !== "deleted" && <Button variant="outline" onClick={() => updateStatus(selected, selected.status === "active" ? "inactive" : "active")}>{selected.status === "active" ? "Deactivate" : "Reactivate"}</Button>}{selected.status !== "deleted" && <Button variant="destructive" onClick={() => deleteReward(selected)}><Trash2 className="mr-1 h-4 w-4"/>Soft delete</Button>}</div></div></div>}
    </div>);
}
