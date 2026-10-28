import { Leaf } from "lucide-react";

/** @param {{ children: import("react").ReactNode }} props */
export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen">
      {/* Left branding panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary text-primary-foreground flex-col justify-center items-center p-12">
        <div className="max-w-md text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Leaf className="h-10 w-10" />
            <span className="text-3xl font-bold tracking-tight">GreenSort</span>
          </div>
          <p className="text-lg opacity-90 leading-relaxed">
            Smart waste segregation powered by AI. Upload waste, earn Green Coins,
            and redeem rewards from local businesses.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4 text-sm opacity-80">
            <div className="bg-primary-foreground/10 rounded-lg p-3">
              <div className="font-semibold text-2xl">7</div>
              <div>Waste categories</div>
            </div>
            <div className="bg-primary-foreground/10 rounded-lg p-3">
              <div className="font-semibold text-2xl">AI</div>
              <div>Classification</div>
            </div>
            <div className="bg-primary-foreground/10 rounded-lg p-3">
              <div className="font-semibold text-2xl">∞</div>
              <div>Green Coins</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <Leaf className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-primary tracking-tight">GreenSort</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
