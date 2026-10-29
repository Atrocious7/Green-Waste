import Link from "next/link";
import { ArrowRight, Coins, Gift, Leaf, Sparkles, UploadCloud } from "lucide-react";

export default function HomePage() {
  const features = [
    {
      title: "1. Upload Waste",
      description: "Snap and upload a photo of segregated household waste (plastic, paper, glass, metal, and more).",
      icon: UploadCloud,
    },
    {
      title: "2. AI Classification",
      description: "Vision AI analyzes your photo in real time to classify the waste category and verify proper sorting.",
      icon: Sparkles,
    },
    {
      title: "3. Earn Green Coins",
      description: "Receive instant Green Coins directly into your account for every verified eco-friendly submission.",
      icon: Coins,
    },
    {
      title: "4. Redeem Rewards",
      description: "Exchange your coins for discount vouchers at verified local partner businesses and cafes.",
      icon: Gift,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-slate-50 flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="border-b border-emerald-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Leaf className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">GreenSort</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Sign In
            </Link>
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              Create Account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24 sm:pb-16 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 shadow-xs mb-6">
            <Leaf className="h-3.5 w-3.5 text-emerald-600" />
            Smart Waste Segregation & Rewards Platform
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Turn your segregated waste into <span className="text-emerald-600">Green Coins</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base text-slate-600 sm:text-lg">
            GreenSort uses AI image classification to verify your recyclable waste. Upload photos of your separated items, earn coins, and redeem them for real-world discounts with local businesses.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/auth/register"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-emerald-700 sm:w-auto"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 sm:w-auto"
            >
              Sign In to Dashboard
            </Link>
          </div>
        </section>

        {/* How It Works Feature Cards */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">How GreenSort Works</h2>
            <p className="mt-2 text-sm text-slate-500">A simple four-step cycle for cleaner communities.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ title, description, icon: Icon }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 mb-4">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p>GreenSort — Local college project demonstration. Built with Next.js, MongoDB, and Vision AI.</p>
        </div>
      </footer>
    </div>
  );
}
