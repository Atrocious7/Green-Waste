"use client";
import { useEffect, useState, useCallback } from "react";
import { Users, Search, Shield, Building2, UserCheck, Coins, ChevronLeft, ChevronRight, Loader2, X, AlertCircle, Eye, RefreshCw, } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
const formatDate = (value) => new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
}).format(new Date(value));
export default function AdminUsersPage() {
    const [users, setUsers] = useState([]);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
        limit: 10,
    });
    const [searchQuery, setSearchQuery] = useState("");
    const [activeSearch, setActiveSearch] = useState("");
    const [selectedRole, setSelectedRole] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    // User Detail / Role Change Modal
    const [selectedUser, setSelectedUser] = useState(null);
    const [newRole, setNewRole] = useState("citizen");
    const [isUpdatingRole, setIsUpdatingRole] = useState(false);
    const fetchUsers = useCallback(async (page = 1, search = activeSearch, role = selectedRole) => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.set("page", page.toString());
            params.set("limit", "10");
            if (search)
                params.set("search", search);
            if (role)
                params.set("role", role);
            const res = await fetch(`/api/admin/users?${params.toString()}`);
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    throw new Error("Access denied. Administrator privileges required.");
                }
                throw new Error("Failed to load user list.");
            }
            const data = await res.json();
            setUsers(data.users || []);
            setPagination(data.pagination || {
                currentPage: 1,
                totalPages: 1,
                totalCount: 0,
                limit: 10,
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "Unable to load users.";
            setError(msg);
            toast.error(msg);
        }
        finally {
            setIsLoading(false);
        }
    }, [activeSearch, selectedRole]);
    useEffect(() => {
        let isMounted = true;
        async function loadInitialUsers() {
            // Don't call setIsLoading(true) here if it's already true by default
            setError(null);
            try {
                const params = new URLSearchParams();
                params.set("page", "1");
                params.set("limit", "10");
                if (activeSearch)
                    params.set("search", activeSearch);
                if (selectedRole)
                    params.set("role", selectedRole);
                const res = await fetch(`/api/admin/users?${params.toString()}`);
                if (!isMounted)
                    return;
                if (!res.ok) {
                    if (res.status === 401 || res.status === 403) {
                        throw new Error("Access denied. Administrator privileges required.");
                    }
                    throw new Error("Failed to load user list.");
                }
                const data = await res.json();
                setUsers(data.users || []);
                setPagination(data.pagination || {
                    currentPage: 1,
                    totalPages: 1,
                    totalCount: 0,
                    limit: 10,
                });
            }
            catch (err) {
                if (isMounted) {
                    setError(err instanceof Error ? err.message : "Unable to load users.");
                }
            }
            finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }
        loadInitialUsers();
        return () => {
            isMounted = false;
        };
    }, [activeSearch, selectedRole]);
    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setActiveSearch(searchQuery.trim());
    };
    const handleClearSearch = () => {
        setSearchQuery("");
        setActiveSearch("");
    };
    const openUserDetail = (user) => {
        setSelectedUser(user);
        setNewRole(user.role);
    };
    const handleUpdateRole = async (e) => {
        e.preventDefault();
        if (!selectedUser)
            return;
        if (newRole === selectedUser.role) {
            toast.info("No role change was selected.");
            return;
        }
        setIsUpdatingRole(true);
        try {
            const res = await fetch(`/api/admin/users/${selectedUser.id}/role`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: newRole }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || "Failed to update user role.");
            }
            toast.success(data.message || "User role updated successfully!");
            setSelectedUser(null);
            fetchUsers(pagination.currentPage, activeSearch, selectedRole);
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to update role.");
        }
        finally {
            setIsUpdatingRole(false);
        }
    };
    const getRoleBadge = (role) => {
        switch (role) {
            case "admin":
                return (<span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800">
            <Shield className="h-3 w-3"/>
            Admin
          </span>);
            case "business":
                return (<span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
            <Building2 className="h-3 w-3"/>
            Business
          </span>);
            default:
                return (<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            <UserCheck className="h-3 w-3"/>
            Citizen
          </span>);
        }
    };
    return (<div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">User Management</h2>
          <p className="text-sm text-slate-500">
            View, search, and manage user accounts and security roles across GreenSort.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => fetchUsers(pagination.currentPage, activeSearch, selectedRole)} disabled={isLoading} className="gap-1.5 self-start text-slate-700 sm:self-auto">
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}/>
          Refresh List
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <form onSubmit={handleSearchSubmit} className="relative flex flex-1 items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-slate-400"/>
            <Input type="text" placeholder="Search by name or email address..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 pr-20"/>
            {searchQuery && (<button type="button" onClick={handleClearSearch} className="absolute right-12 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4"/>
              </button>)}
            <Button type="submit" size="sm" className="absolute right-1 bg-emerald-600 hover:bg-emerald-700">
              Search
            </Button>
          </form>

          {/* Role Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
            <button type="button" onClick={() => setSelectedRole("")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${selectedRole === ""
            ? "bg-white text-slate-900 shadow-xs"
            : "text-slate-600 hover:text-slate-900"}`}>
              All
            </button>
            <button type="button" onClick={() => setSelectedRole("citizen")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${selectedRole === "citizen"
            ? "bg-white text-emerald-800 shadow-xs"
            : "text-slate-600 hover:text-slate-900"}`}>
              Citizens
            </button>
            <button type="button" onClick={() => setSelectedRole("business")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${selectedRole === "business"
            ? "bg-white text-blue-800 shadow-xs"
            : "text-slate-600 hover:text-slate-900"}`}>
              Businesses
            </button>
            <button type="button" onClick={() => setSelectedRole("admin")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${selectedRole === "admin"
            ? "bg-white text-red-800 shadow-xs"
            : "text-slate-600 hover:text-slate-900"}`}>
              Admins
            </button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (<div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600"/>
          <p className="flex-1 font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchUsers(pagination.currentPage, activeSearch, selectedRole)} className="border-red-200 text-red-800">
            Retry
          </Button>
        </div>)}

      {/* Users Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {isLoading ? (<div className="flex flex-col items-center justify-center p-16">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600"/>
            <p className="mt-3 text-sm text-slate-500">Loading user records...</p>
          </div>) : users.length === 0 ? (<div className="p-12 text-center">
            <Users className="mx-auto h-12 w-12 text-slate-300"/>
            <h3 className="mt-3 text-lg font-semibold text-slate-800">No users found</h3>
            <p className="mt-1 text-sm text-slate-500">
              {activeSearch || selectedRole
                ? "Try adjusting your search query or role filter."
                : "No registered accounts exist yet."}
            </p>
            {(activeSearch || selectedRole) && (<Button variant="outline" size="sm" onClick={() => {
                    setSearchQuery("");
                    setActiveSearch("");
                    setSelectedRole("");
                }} className="mt-4">
                Clear all filters
              </Button>)}
          </div>) : (<div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Green Coins</th>
                  <th className="px-5 py-3.5">Registered</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (<tr key={u.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">{getRoleBadge(u.role)}</td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                        <Coins className="h-4 w-4"/>
                        <span>{u.greenCoins}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => openUserDetail(u)} className="gap-1.5 text-xs text-slate-700 hover:text-emerald-700">
                        <Eye className="h-3.5 w-3.5"/>
                        Manage Role
                      </Button>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>)}

        {/* Pagination Bar */}
        {users.length > 0 && (<div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-5 py-3 sm:flex-row">
            <p className="text-xs text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-800">
                {(pagination.currentPage - 1) * pagination.limit + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-slate-800">
                {Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)}
              </span>{" "}
              of <span className="font-semibold text-slate-800">{pagination.totalCount}</span> users
            </p>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => fetchUsers(pagination.currentPage - 1, activeSearch, selectedRole)} disabled={pagination.currentPage <= 1 || isLoading} className="h-8 gap-1 px-2.5 text-xs">
                <ChevronLeft className="h-3.5 w-3.5"/>
                Previous
              </Button>

              <span className="text-xs font-semibold text-slate-700">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>

              <Button variant="outline" size="sm" onClick={() => fetchUsers(pagination.currentPage + 1, activeSearch, selectedRole)} disabled={pagination.currentPage >= pagination.totalPages || isLoading} className="h-8 gap-1 px-2.5 text-xs">
                Next
                <ChevronRight className="h-3.5 w-3.5"/>
              </Button>
            </div>
          </div>)}
      </div>

      {/* User Details & Role Management Modal */}
      {selectedUser && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-700"/>
                <h3 className="text-lg font-bold text-slate-900">User Details & Role</h3>
              </div>
              <button type="button" onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5"/>
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl bg-slate-50 p-4 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">User ID:</span>
                  <span className="font-mono text-slate-800">{selectedUser.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Full Name:</span>
                  <span className="font-semibold text-slate-900">{selectedUser.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Email Address:</span>
                  <span className="text-slate-800">{selectedUser.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Current Role:</span>
                  <span>{getRoleBadge(selectedUser.role)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Green Coins:</span>
                  <span className="font-semibold text-emerald-700">{selectedUser.greenCoins}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Joined:</span>
                  <span className="text-slate-800">{formatDate(selectedUser.createdAt)}</span>
                </div>
              </div>

              {/* Role Change Form */}
              <form onSubmit={handleUpdateRole} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="role-select" className="text-sm font-semibold text-slate-900">
                    Assign Role
                  </Label>
                  <select id="role-select" value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-full rounded-md border border-slate-200 p-2 text-sm shadow-xs focus:border-emerald-500 focus:outline-hidden">
                    <option value="citizen">Citizen (Waste submission & rewards)</option>
                    <option value="business">Business (Merchant rewards & voucher validation)</option>
                    <option value="admin">Admin (System overview & user management)</option>
                  </select>
                  <p className="text-xs text-slate-500">
                    * Protection enabled: The last administrator account cannot be demoted.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setSelectedUser(null)} disabled={isUpdatingRole}>
                    Close
                  </Button>
                  <Button type="submit" disabled={isUpdatingRole || newRole === selectedUser.role} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
                    {isUpdatingRole ? (<>
                        <Loader2 className="h-4 w-4 animate-spin"/>
                        Updating...
                      </>) : ("Save Role")}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>)}
    </div>);
}
