"use client";
import { useEffect, useState, useCallback } from "react";
import { Building2, Search, ShieldCheck, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, Loader2, X, Mail, MapPin, Lock, Unlock, } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
const formatDate = (value) => new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
}).format(new Date(value));
export default function AdminBusinessPage() {
    const [businesses, setBusinesses] = useState([]);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
        limit: 10,
    });
    const [searchQuery, setSearchQuery] = useState("");
    const [activeSearch, setActiveSearch] = useState("");
    const [selectedVerification, setSelectedVerification] = useState("");
    const [selectedSuspension, setSelectedSuspension] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    // Business Detail / Verification / Suspension Modal
    const [selectedBusiness, setSelectedBusiness] = useState(null);
    const [modalVerified, setModalVerified] = useState(false);
    const [modalSuspended, setModalSuspended] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const fetchBusinesses = useCallback(async (page = 1, search = activeSearch, verified = selectedVerification, suspended = selectedSuspension) => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.set("page", page.toString());
            params.set("limit", "10");
            if (search)
                params.set("search", search);
            if (verified)
                params.set("verified", verified);
            if (suspended)
                params.set("suspended", suspended);
            const res = await fetch(`/api/admin/business?${params.toString()}`);
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    throw new Error("Access denied. Administrator privileges required.");
                }
                throw new Error("Failed to load business list.");
            }
            const data = await res.json();
            setBusinesses(data.businesses || []);
            setPagination(data.pagination || {
                currentPage: 1,
                totalPages: 1,
                totalCount: 0,
                limit: 10,
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "Unable to load businesses.";
            setError(msg);
            toast.error(msg);
        }
        finally {
            setIsLoading(false);
        }
    }, [activeSearch, selectedVerification, selectedSuspension]);
    useEffect(() => {
        let isMounted = true;
        async function loadInitialBusinesses() {
            setError(null);
            try {
                const params = new URLSearchParams();
                params.set("page", "1");
                params.set("limit", "10");
                if (activeSearch)
                    params.set("search", activeSearch);
                if (selectedVerification)
                    params.set("verified", selectedVerification);
                if (selectedSuspension)
                    params.set("suspended", selectedSuspension);
                const res = await fetch(`/api/admin/business?${params.toString()}`);
                if (!isMounted)
                    return;
                if (!res.ok) {
                    if (res.status === 401 || res.status === 403) {
                        throw new Error("Access denied. Administrator privileges required.");
                    }
                    throw new Error("Failed to load business list.");
                }
                const data = await res.json();
                setBusinesses(data.businesses || []);
                setPagination(data.pagination || {
                    currentPage: 1,
                    totalPages: 1,
                    totalCount: 0,
                    limit: 10,
                });
            }
            catch (err) {
                if (isMounted) {
                    setError(err instanceof Error ? err.message : "Unable to load businesses.");
                }
            }
            finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }
        loadInitialBusinesses();
        return () => {
            isMounted = false;
        };
    }, [activeSearch, selectedVerification, selectedSuspension]);
    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setActiveSearch(searchQuery.trim());
    };
    const handleClearSearch = () => {
        setSearchQuery("");
        setActiveSearch("");
    };
    const openBusinessModal = (biz) => {
        setSelectedBusiness(biz);
        setModalVerified(biz.verified);
        setModalSuspended(biz.suspended);
    };
    const handleUpdateBusiness = async (e) => {
        e.preventDefault();
        if (!selectedBusiness)
            return;
        if (modalVerified === selectedBusiness.verified && modalSuspended === selectedBusiness.suspended) {
            toast.info("No changes were made to verification or suspension status.");
            return;
        }
        setIsUpdating(true);
        try {
            const res = await fetch(`/api/admin/business/${selectedBusiness.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    verified: modalVerified,
                    suspended: modalSuspended,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || "Failed to update business status.");
            }
            toast.success(data.message || "Business status updated successfully!");
            setSelectedBusiness(null);
            fetchBusinesses(pagination.currentPage, activeSearch, selectedVerification, selectedSuspension);
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to update business.");
        }
        finally {
            setIsUpdating(false);
        }
    };
    const getVerificationBadge = (verified) => {
        if (verified) {
            return (<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
          <ShieldCheck className="h-3 w-3"/>
          Verified
        </span>);
        }
        return (<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
        <AlertCircle className="h-3 w-3"/>
        Unverified
      </span>);
    };
    const getSuspensionBadge = (suspended) => {
        if (suspended) {
            return (<span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
          <Lock className="h-3 w-3"/>
          Suspended
        </span>);
        }
        return (<span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
        <Unlock className="h-3 w-3"/>
        Active
      </span>);
    };
    return (<div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Business Management & Verification</h2>
          <p className="text-sm text-slate-500">
            Review partner businesses, manage verification status, and control merchant accounts.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => fetchBusinesses(pagination.currentPage, activeSearch, selectedVerification, selectedSuspension)} disabled={isLoading} className="gap-1.5 self-start text-slate-700 sm:self-auto">
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}/>
          Refresh List
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <form onSubmit={handleSearchSubmit} className="relative flex flex-1 items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-slate-400"/>
            <Input type="text" placeholder="Search by business name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 pr-20"/>
            {searchQuery && (<button type="button" onClick={handleClearSearch} className="absolute right-12 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4"/>
              </button>)}
            <Button type="submit" size="sm" className="absolute right-1 bg-emerald-600 hover:bg-emerald-700">
              Search
            </Button>
          </form>

          {/* Verification Status Filter */}
          <div className="w-full sm:w-48">
            <Select value={selectedVerification} onValueChange={(val) => setSelectedVerification(val ?? "")}>
              <SelectTrigger className="h-9 text-sm w-full">
                <SelectValue placeholder="Verification Status"/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Verifications</SelectItem>
                <SelectItem value="true">Verified Only</SelectItem>
                <SelectItem value="false">Unverified Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Suspension Status Filter */}
          <div className="w-full sm:w-48">
            <Select value={selectedSuspension} onValueChange={(val) => setSelectedSuspension(val ?? "")}>
              <SelectTrigger className="h-9 text-sm w-full">
                <SelectValue placeholder="Account Status"/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Account Statuses</SelectItem>
                <SelectItem value="false">Active Only</SelectItem>
                <SelectItem value="true">Suspended Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (<div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600"/>
          <p className="flex-1 font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchBusinesses(pagination.currentPage, activeSearch, selectedVerification, selectedSuspension)} className="border-red-200 text-red-800">
            Retry
          </Button>
        </div>)}

      {/* Businesses Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {isLoading ? (<div className="flex flex-col items-center justify-center p-16">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600"/>
            <p className="mt-3 text-sm text-slate-500">Loading business records...</p>
          </div>) : businesses.length === 0 ? (<div className="p-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-slate-300"/>
            <h3 className="mt-3 text-lg font-semibold text-slate-800">No businesses found</h3>
            <p className="mt-1 text-sm text-slate-500">
              {activeSearch || selectedVerification || selectedSuspension
                ? "Try adjusting your search query or filters."
                : "No partner businesses registered yet."}
            </p>
            {(activeSearch || selectedVerification || selectedSuspension) && (<Button variant="outline" size="sm" onClick={() => {
                    setSearchQuery("");
                    setActiveSearch("");
                    setSelectedVerification("");
                    setSelectedSuspension("");
                }} className="mt-4">
                Clear all filters
              </Button>)}
          </div>) : (<div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Business Name</th>
                  <th className="px-5 py-3.5">Contact Email</th>
                  <th className="px-5 py-3.5">Address</th>
                  <th className="px-5 py-3.5">Verification</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {businesses.map((biz) => (<tr key={biz.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{biz.businessName}</p>
                      <p className="text-xs text-slate-500">ID: {biz.id}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-slate-800">
                        <Mail className="h-3.5 w-3.5 text-slate-400"/>
                        <span>{biz.email}</span>
                      </div>
                      {biz.userEmail && biz.userEmail !== biz.email && (<p className="text-[11px] text-slate-500">User: {biz.userEmail}</p>)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-slate-600 max-w-xs truncate">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400"/>
                        <span className="truncate">{biz.address || "No address provided"}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">{getVerificationBadge(biz.verified)}</td>
                    <td className="whitespace-nowrap px-5 py-4">{getSuspensionBadge(biz.suspended)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => openBusinessModal(biz)} className="gap-1.5 text-xs text-slate-700 hover:text-emerald-700">
                        <ShieldCheck className="h-3.5 w-3.5"/>
                        Manage
                      </Button>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>)}

        {/* Pagination Bar */}
        {businesses.length > 0 && (<div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-5 py-3 sm:flex-row">
            <p className="text-xs text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-800">
                {(pagination.currentPage - 1) * pagination.limit + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-slate-800">
                {Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)}
              </span>{" "}
              of <span className="font-semibold text-slate-800">{pagination.totalCount}</span> businesses
            </p>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => fetchBusinesses(pagination.currentPage - 1, activeSearch, selectedVerification, selectedSuspension)} disabled={pagination.currentPage <= 1 || isLoading} className="h-8 gap-1 px-2.5 text-xs">
                <ChevronLeft className="h-3.5 w-3.5"/>
                Previous
              </Button>

              <span className="text-xs font-semibold text-slate-700">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>

              <Button variant="outline" size="sm" onClick={() => fetchBusinesses(pagination.currentPage + 1, activeSearch, selectedVerification, selectedSuspension)} disabled={pagination.currentPage >= pagination.totalPages || isLoading} className="h-8 gap-1 px-2.5 text-xs">
                Next
                <ChevronRight className="h-3.5 w-3.5"/>
              </Button>
            </div>
          </div>)}
      </div>

      {/* Business Verification & Suspension Modal */}
      {selectedBusiness && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-700"/>
                <h3 className="text-lg font-bold text-slate-900">Manage Business Verification</h3>
              </div>
              <button type="button" onClick={() => setSelectedBusiness(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5"/>
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl bg-slate-50 p-4 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Business ID:</span>
                  <span className="font-mono text-slate-800">{selectedBusiness.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Business Name:</span>
                  <span className="font-semibold text-slate-900">{selectedBusiness.businessName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Contact Email:</span>
                  <span className="text-slate-800">{selectedBusiness.email}</span>
                </div>
                {selectedBusiness.userEmail && (<div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Linked Account:</span>
                    <span className="text-slate-800">{selectedBusiness.userEmail}</span>
                  </div>)}
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Address:</span>
                  <span className="text-slate-800">{selectedBusiness.address || "Not provided"}</span>
                </div>
                {selectedBusiness.description && (<div className="flex flex-col gap-1 pt-1">
                    <span className="text-slate-500 font-medium">Description:</span>
                    <p className="text-slate-700 italic bg-white p-2 rounded border border-slate-200">
                      {selectedBusiness.description}
                    </p>
                  </div>)}
                <div className="flex justify-between pt-1">
                  <span className="text-slate-500 font-medium">Registered:</span>
                  <span className="text-slate-800">{formatDate(selectedBusiness.createdAt)}</span>
                </div>
              </div>

              {/* Form to toggle verified and suspended */}
              <form onSubmit={handleUpdateBusiness} className="space-y-4 pt-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5 bg-white">
                    <div>
                      <Label htmlFor="verified-toggle" className="text-sm font-semibold text-slate-900">
                        Verified Partner Status
                      </Label>
                      <p className="text-xs text-slate-500">
                        When verified, this business&apos;s rewards appear in the citizen catalog.
                      </p>
                    </div>
                    <input id="verified-toggle" type="checkbox" checked={modalVerified} onChange={(e) => setModalVerified(e.target.checked)} className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"/>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5 bg-white">
                    <div>
                      <Label htmlFor="suspended-toggle" className="text-sm font-semibold text-slate-900">
                        Account Suspended
                      </Label>
                      <p className="text-xs text-slate-500">
                        When suspended, merchant operations are restricted.
                      </p>
                    </div>
                    <input id="suspended-toggle" type="checkbox" checked={modalSuspended} onChange={(e) => setModalSuspended(e.target.checked)} className="h-5 w-5 rounded border-slate-300 text-red-600 focus:ring-red-500"/>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setSelectedBusiness(null)} disabled={isUpdating}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isUpdating ||
                (modalVerified === selectedBusiness.verified &&
                    modalSuspended === selectedBusiness.suspended)} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
                    {isUpdating ? (<>
                        <Loader2 className="h-4 w-4 animate-spin"/>
                        Saving...
                      </>) : ("Save Status")}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>)}
    </div>);
}
