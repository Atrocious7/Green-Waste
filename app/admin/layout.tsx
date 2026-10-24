"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, ShieldCheck, FileText, BarChart2 } from "lucide-react";

import { DashboardLogoutButton } from "@/components/dashboard-logout";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Overview",
      href: "/admin/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Submissions",
      href: "/admin/submissions",
      icon: FileText,
    },
    {
      label: "Users",
      href: "/admin/users",
      icon: Users,
    },
    {
      label: "Analytics",
      href: "/admin/analytics",
      icon: BarChart2,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-2xl border border-emerald-100 bg-white/95 p-4 shadow-sm backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 shadow-xs">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">GreenSort</p>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                    Administrator
                  </span>
                </div>
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Admin Portal</h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <nav className="flex items-center rounded-xl bg-slate-100 p-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                        isActive
                          ? "bg-white text-emerald-800 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <DashboardLogoutButton />
            </div>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}
