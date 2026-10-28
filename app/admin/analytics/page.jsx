"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { Calendar, Loader2, AlertCircle, RefreshCw, TrendingUp, TrendingDown, Minus, } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
const formatDate = (value) => new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
}).format(new Date(value));
const formatNumber = (num) => num.toLocaleString();
export default function AdminAnalyticsPage() {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedRange, setSelectedRange] = useState("30d");
    const submissionsChartRef = useRef(null);
    const categoriesChartRef = useRef(null);
    const coinsChartRef = useRef(null);
    const statusChartRef = useRef(null);
    const redemptionsChartRef = useRef(null);
    const submissionsChartInstance = useRef(null);
    const categoriesChartInstance = useRef(null);
    const coinsChartInstance = useRef(null);
    const statusChartInstance = useRef(null);
    const redemptionsChartInstance = useRef(null);
    const fetchAnalytics = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/analytics?range=${selectedRange}`);
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    throw new Error("Access denied. Administrator privileges required.");
                }
                throw new Error("Failed to load analytics data.");
            }
            const result = await res.json();
            setData(result);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "Unable to load analytics.";
            setError(msg);
            toast.error(msg);
        }
        finally {
            setIsLoading(false);
        }
    }, [selectedRange]);
    useEffect(() => {
        let isMounted = true;
        async function loadInitialAnalytics() {
            setError(null);
            try {
                const res = await fetch(`/api/admin/analytics?range=${selectedRange}`);
                if (!isMounted)
                    return;
                if (!res.ok) {
                    if (res.status === 401 || res.status === 403) {
                        throw new Error("Access denied. Administrator privileges required.");
                    }
                    throw new Error("Failed to load analytics data.");
                }
                const result = await res.json();
                if (isMounted) {
                    setData(result);
                }
            }
            catch (err) {
                if (isMounted) {
                    setError(err instanceof Error ? err.message : "Unable to load analytics.");
                }
            }
            finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }
        loadInitialAnalytics();
        return () => {
            isMounted = false;
        };
    }, [selectedRange]);
    // Render charts when data changes
    useEffect(() => {
        if (!data)
            return;
        let isEffectActive = true;
        // Destroy existing chart instances before creating new ones
        if (submissionsChartInstance.current) {
            submissionsChartInstance.current.destroy();
            submissionsChartInstance.current = null;
        }
        if (categoriesChartInstance.current) {
            categoriesChartInstance.current.destroy();
            categoriesChartInstance.current = null;
        }
        if (coinsChartInstance.current) {
            coinsChartInstance.current.destroy();
            coinsChartInstance.current = null;
        }
        if (statusChartInstance.current) {
            statusChartInstance.current.destroy();
            statusChartInstance.current = null;
        }
        if (redemptionsChartInstance.current) {
            redemptionsChartInstance.current.destroy();
            redemptionsChartInstance.current = null;
        }
        // Dynamically import Chart.js
        import("chart.js/auto").then(({ Chart, registerables }) => {
            if (!isEffectActive)
                return;
            Chart.register(...registerables);
            // Submissions Over Time Chart (Line)
            if (submissionsChartRef.current) {
                submissionsChartInstance.current = new Chart(submissionsChartRef.current, {
                    type: "line",
                    data: {
                        labels: data.submissionsOverTime.map((d) => formatDate(d.date)),
                        datasets: [
                            {
                                label: "Submissions",
                                data: data.submissionsOverTime.map((d) => d.count),
                                borderColor: "rgb(34, 197, 94)",
                                backgroundColor: "rgba(34, 197, 94, 0.1)",
                                fill: true,
                                tension: 0.3,
                                pointRadius: 3,
                                pointHoverRadius: 5,
                            },
                        ],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                        },
                        scales: {
                            y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" } },
                            x: { grid: { display: false } },
                        },
                    },
                });
            }
            // Categories Distribution Chart (Doughnut)
            if (categoriesChartRef.current && data.categoriesDistribution.length > 0) {
                const colors = [
                    "rgb(34, 197, 94)", // emerald
                    "rgb(59, 130, 246)", // blue
                    "rgb(168, 85, 247)", // purple
                    "rgb(249, 115, 22)", // orange
                    "rgb(236, 72, 153)", // pink
                    "rgb(20, 184, 166)", // teal
                    "rgb(107, 114, 128)", // gray
                ];
                categoriesChartInstance.current = new Chart(categoriesChartRef.current, {
                    type: "doughnut",
                    data: {
                        labels: data.categoriesDistribution.map((d) => d.category),
                        datasets: [
                            {
                                data: data.categoriesDistribution.map((d) => d.count),
                                backgroundColor: colors.slice(0, data.categoriesDistribution.length),
                                borderWidth: 2,
                                borderColor: "#ffffff",
                            },
                        ],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: "bottom", labels: { usePointStyle: true, padding: 15 } },
                        },
                        cutout: "60%",
                    },
                });
            }
            // Coins Awarded Over Time Chart (Bar)
            if (coinsChartRef.current) {
                coinsChartInstance.current = new Chart(coinsChartRef.current, {
                    type: "bar",
                    data: {
                        labels: data.coinsAwardedOverTime.map((d) => formatDate(d.date)),
                        datasets: [
                            {
                                label: "Green Coins Awarded",
                                data: data.coinsAwardedOverTime.map((d) => d.totalCoins),
                                backgroundColor: "rgba(34, 197, 94, 0.7)",
                                borderColor: "rgb(34, 197, 94)",
                                borderWidth: 1,
                                borderRadius: 4,
                            },
                        ],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                        },
                        scales: {
                            y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" } },
                            x: { grid: { display: false } },
                        },
                    },
                });
            }
            // Status Summary Chart (Bar)
            if (statusChartRef.current) {
                const statusData = [
                    { label: "Approved", count: data.statusSummary.approved, color: "rgb(34, 197, 94)" },
                    { label: "Awarded", count: data.statusSummary.awarded, color: "rgb(20, 184, 166)" },
                    { label: "Pending", count: data.statusSummary.pending, color: "rgb(249, 115, 22)" },
                    { label: "Needs Review", count: data.statusSummary.needs_review, color: "rgb(234, 179, 8)" },
                    { label: "Rejected", count: data.statusSummary.rejected, color: "rgb(239, 68, 68)" },
                ].filter((s) => s.count > 0);
                statusChartInstance.current = new Chart(statusChartRef.current, {
                    type: "bar",
                    data: {
                        labels: statusData.map((s) => s.label),
                        datasets: [
                            {
                                label: "Count",
                                data: statusData.map((s) => s.count),
                                backgroundColor: statusData.map((s) => s.color + "CC"),
                                borderColor: statusData.map((s) => s.color),
                                borderWidth: 1,
                                borderRadius: 4,
                            },
                        ],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                        },
                        scales: {
                            y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" } },
                            x: { grid: { display: false } },
                        },
                    },
                });
            }
            // Redemptions Chart (Doughnut)
            if (redemptionsChartRef.current && data.redemptions.length > 0) {
                const statusColors = {
                    completed: "rgb(34, 197, 94)",
                    redeemed: "rgb(34, 197, 94)",
                    pending: "rgb(249, 115, 22)",
                    cancelled: "rgb(239, 68, 68)",
                };
                redemptionsChartInstance.current = new Chart(redemptionsChartRef.current, {
                    type: "doughnut",
                    data: {
                        labels: data.redemptions.map((d) => d.status),
                        datasets: [
                            {
                                data: data.redemptions.map((d) => d.count),
                                backgroundColor: data.redemptions.map((d) => statusColors[d.status] || "rgb(107, 114, 128)"),
                                borderWidth: 2,
                                borderColor: "#ffffff",
                            },
                        ],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: "bottom", labels: { usePointStyle: true, padding: 15 } },
                        },
                        cutout: "60%",
                    },
                });
            }
        });
        return () => {
            isEffectActive = false;
            if (submissionsChartInstance.current) {
                submissionsChartInstance.current.destroy();
                submissionsChartInstance.current = null;
            }
            if (categoriesChartInstance.current) {
                categoriesChartInstance.current.destroy();
                categoriesChartInstance.current = null;
            }
            if (coinsChartInstance.current) {
                coinsChartInstance.current.destroy();
                coinsChartInstance.current = null;
            }
            if (statusChartInstance.current) {
                statusChartInstance.current.destroy();
                statusChartInstance.current = null;
            }
            if (redemptionsChartInstance.current) {
                redemptionsChartInstance.current.destroy();
                redemptionsChartInstance.current = null;
            }
        };
    }, [data]);
    const ranges = [
        { value: "7d", label: "Last 7 Days" },
        { value: "30d", label: "Last 30 Days" },
        { value: "90d", label: "Last 90 Days" },
        { value: "1y", label: "Last Year" },
        { value: "all", label: "All Time" },
    ];
    const statusSummaryItems = [
        { label: "Approved", count: data?.statusSummary.approved ?? 0, icon: TrendingUp, color: "text-emerald-700 bg-emerald-50" },
        { label: "Awarded", count: data?.statusSummary.awarded ?? 0, icon: TrendingUp, color: "text-teal-700 bg-teal-50" },
        { label: "Pending", count: data?.statusSummary.pending ?? 0, icon: Minus, color: "text-orange-700 bg-orange-50" },
        { label: "Needs Review", count: data?.statusSummary.needs_review ?? 0, icon: Minus, color: "text-amber-700 bg-amber-50" },
        { label: "Rejected", count: data?.statusSummary.rejected ?? 0, icon: TrendingDown, color: "text-red-700 bg-red-50" },
    ];
    return (<div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Analytics</h2>
          <p className="text-sm text-slate-500">
            Platform insights and trends from live MongoDB data.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-44">
            <Select value={selectedRange} onValueChange={(value) => setSelectedRange(value ?? "")}>
              <SelectTrigger className="h-9 text-sm w-full">
                <SelectValue placeholder="Time range"/>
              </SelectTrigger>
              <SelectContent>
                {ranges.map((r) => (<SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="sm" onClick={fetchAnalytics} disabled={isLoading} className="gap-1.5 self-start text-slate-700 sm:self-auto">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}/>
            Refresh
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (<div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600"/>
          <p className="flex-1 font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchAnalytics} className="border-red-200 text-red-800">
            Retry
          </Button>
        </div>)}

      {/* Status Summary Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statusSummaryItems.map((item) => {
            const Icon = item.icon;
            return (<Card key={item.label} className="shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{item.label}</p>
                  <div className={`rounded-xl p-2 ${item.color}`}>
                    <Icon className="h-4 w-4"/>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-3xl font-extrabold text-slate-900">
                  {isLoading ? (<Loader2 className="h-6 w-6 animate-spin text-slate-400"/>) : (formatNumber(item.count))}
                </div>
              </CardContent>
            </Card>);
        })}
      </section>

      {/* Charts Grid */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Submissions Over Time */}
        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Submissions Over Time</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (<div className="h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600"/>
              </div>) : data?.submissionsOverTime.length === 0 ? (<div className="h-64 flex flex-col items-center justify-center text-center text-slate-500">
                <Calendar className="mx-auto h-12 w-12 text-slate-300"/>
                <p className="mt-2 text-sm">No submissions in this time range</p>
              </div>) : (<div className="h-64">
                <canvas ref={submissionsChartRef}/>
              </div>)}
          </CardContent>
        </Card>

        {/* Categories Distribution */}
        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Waste Categories Distribution</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (<div className="h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600"/>
              </div>) : data?.categoriesDistribution.length === 0 ? (<div className="h-64 flex flex-col items-center justify-center text-center text-slate-500">
                <Calendar className="mx-auto h-12 w-12 text-slate-300"/>
                <p className="mt-2 text-sm">No category data in this time range</p>
              </div>) : (<div className="h-64">
                <canvas ref={categoriesChartRef}/>
              </div>)}
          </CardContent>
        </Card>

        {/* Coins Awarded Over Time */}
        <Card className="shadow-xs lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Green Coins Awarded Over Time</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (<div className="h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600"/>
              </div>) : data?.coinsAwardedOverTime.length === 0 ? (<div className="h-64 flex flex-col items-center justify-center text-center text-slate-500">
                <Calendar className="mx-auto h-12 w-12 text-slate-300"/>
                <p className="mt-2 text-sm">No coins awarded in this time range</p>
              </div>) : (<div className="h-64">
                <canvas ref={coinsChartRef}/>
              </div>)}
          </CardContent>
        </Card>

        {/* Status Summary */}
        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Submission Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (<div className="h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600"/>
              </div>) : (<div className="h-64">
                <canvas ref={statusChartRef}/>
              </div>)}
          </CardContent>
        </Card>

        {/* Redemptions */}
        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Redemption Statuses</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (<div className="h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600"/>
              </div>) : data?.redemptions.length === 0 ? (<div className="h-64 flex flex-col items-center justify-center text-center text-slate-500">
                <Calendar className="mx-auto h-12 w-12 text-slate-300"/>
                <p className="mt-2 text-sm">No redemptions in this time range</p>
              </div>) : (<div className="h-64">
                <canvas ref={redemptionsChartRef}/>
              </div>)}
          </CardContent>
        </Card>
      </div>
    </div>);
}
