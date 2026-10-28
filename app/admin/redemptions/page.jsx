"use client";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Loader2, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
const formatDate = (value) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
export default function AdminRedemptionsPage() {
    const [items, setItems] = useState([]);
    const [businesses, setBusinesses] = useState([]);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0, limit: 10 });
    const [search, setSearch] = useState("");
    const [activeSearch, setActiveSearch] = useState("");
    const [businessId, setBusinessId] = useState("all");
    const [status, setStatus] = useState("all");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selected, setSelected] = useState(null);
    const load = useCallback(async (page = 1) => {
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
            if (from)
                params.set("from", from);
            if (to)
                params.set("to", to);
            const response = await fetch(`/api/admin/redemptions?${params.toString()}`);
            const data = await response.json().catch(() => ({}));
            if (!response.ok)
                throw new Error(data.error || "Unable to load redemption audit.");
            setItems(data.redemptions ?? []);
            setBusinesses(data.businesses ?? []);
            setPagination(data.pagination);
        }
        catch (loadError) {
            const message = loadError instanceof Error ? loadError.message : "Unable to load redemption audit.";
            setError(message);
            toast.error(message);
        }
        finally {
            setLoading(false);
        }
    }, [activeSearch, businessId, from, status, to]);
    useEffect(() => { const timer = window.setTimeout(() => void load(1), 0); return () => window.clearTimeout(timer); }, [load]);
    const auditClass = (statusValue) => statusValue === "consistent" ? "bg-emerald-100 text-emerald-800" : statusValue === "warning" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
    return <div className="space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-2xl font-bold text-slate-900">Redemption Audit</h2><p className="text-sm text-slate-500">Read-only inspection of vouchers and linked Green Coin ledger entries.</p></div><Button variant="outline" size="sm" onClick={() => load(pagination.currentPage)} disabled={loading} className="gap-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}/>Refresh</Button></header>
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:flex-row"><form className="relative flex-1" onSubmit={(event) => { event.preventDefault(); setActiveSearch(search.trim()); }}><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search code, reward, business, citizen, or email" className="pl-9"/></form><Select value={businessId} onValueChange={(value) => setBusinessId(value ?? "all")}><SelectTrigger className="w-full xl:w-52"><SelectValue placeholder="All businesses"/></SelectTrigger><SelectContent><SelectItem value="all">All businesses</SelectItem>{businesses.map((business) => <SelectItem key={business.id} value={business.id}>{business.name}</SelectItem>)}</SelectContent></Select><Select value={status} onValueChange={(value) => setStatus(value ?? "all")}><SelectTrigger className="w-full xl:w-40"><SelectValue placeholder="All statuses"/></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="redeemed">Redeemed</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="From date" className="w-full xl:w-40"/><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="To date" className="w-full xl:w-40"/></div>
    {error && <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{error}</span><Button variant="outline" size="sm" onClick={() => load(pagination.currentPage)}>Retry</Button></div>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{loading ? <div className="flex flex-col items-center p-16"><Loader2 className="h-8 w-8 animate-spin text-emerald-600"/><p className="mt-3 text-sm text-slate-500">Loading audit records...</p></div> : items.length === 0 ? <div className="p-16 text-center"><ClipboardCheck className="mx-auto h-10 w-10 text-slate-300"/><h3 className="mt-3 font-semibold text-slate-800">No redemptions found</h3><p className="mt-1 text-sm text-slate-500">Try a different search or filter.</p></div> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><th className="px-5 py-3">Voucher</th><th className="px-5 py-3">Reward / Business</th><th className="px-5 py-3">Citizen</th><th className="px-5 py-3">Coins</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Audit</th><th className="px-5 py-3 text-right">Details</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="px-5 py-4"><p className="font-mono font-semibold text-slate-900">{item.redemptionCode}</p><p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p></td><td className="px-5 py-4"><p className="font-medium text-slate-800">{item.reward?.title ?? "Missing reward"}</p><p className="text-xs text-slate-500">{item.business?.name ?? "Missing business"}</p></td><td className="px-5 py-4"><p className="font-medium text-slate-800">{item.citizen?.name ?? "Missing citizen"}</p><p className="text-xs text-slate-500">{item.citizen?.email ?? ""}</p></td><td className="px-5 py-4 text-slate-700">{item.coinsUsed}</td><td className="px-5 py-4 capitalize text-slate-700">{item.status}</td><td className="px-5 py-4"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${auditClass(item.audit.status)}`}>{item.audit.status === "consistent" ? <CheckCircle2 className="h-3 w-3"/> : <AlertCircle className="h-3 w-3"/>}{item.audit.status}</span></td><td className="px-5 py-4 text-right"><Button variant="outline" size="sm" onClick={() => setSelected(item)}>Inspect</Button></td></tr>)}</tbody></table></div>} {!loading && items.length > 0 && <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/60 px-5 py-3 text-xs text-slate-600"><span>{pagination.totalCount} records · page {pagination.currentPage} of {pagination.totalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={pagination.currentPage <= 1} onClick={() => load(pagination.currentPage - 1)}><ChevronLeft className="h-4 w-4"/></Button><Button variant="outline" size="sm" disabled={pagination.currentPage >= pagination.totalPages} onClick={() => load(pagination.currentPage + 1)}><ChevronRight className="h-4 w-4"/></Button></div></div>}</section>
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Read-only audit details</p><h3 className="mt-1 text-xl font-bold text-slate-900">{selected.redemptionCode}</h3></div><button type="button" onClick={() => setSelected(null)} aria-label="Close"><X className="h-5 w-5 text-slate-500"/></button></div><dl className="mt-5 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-slate-500">Reward</dt><dd className="font-medium">{selected.reward?.title ?? "Missing"}</dd></div><div><dt className="text-slate-500">Business</dt><dd className="font-medium">{selected.business?.name ?? "Missing"}</dd></div><div><dt className="text-slate-500">Citizen</dt><dd className="font-medium">{selected.citizen?.email ?? "Missing"}</dd></div><div><dt className="text-slate-500">Coins used</dt><dd className="font-medium">{selected.coinsUsed}</dd></div><div><dt className="text-slate-500">Ledger amount</dt><dd className="font-medium">{selected.ledgerTransaction?.amount ?? "Missing"}</dd></div><div><dt className="text-slate-500">Balance after</dt><dd className="font-medium">{selected.ledgerTransaction?.balanceAfter ?? "Missing"}</dd></div></dl><div className={`mt-5 rounded-xl p-4 ${auditClass(selected.audit.status)}`}><p className="font-semibold">Audit: {selected.audit.status}</p>{selected.audit.explanations.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm">{selected.audit.explanations.map((explanation) => <li key={explanation}>{explanation}</li>)}</ul>}{selected.audit.explanations.length === 0 && <p className="mt-1 text-sm">No supported inconsistency was detected.</p>}</div><div className="mt-6 flex justify-end"><Button variant="outline" onClick={() => setSelected(null)}>Close</Button></div></div></div>}
  </div>;
}
