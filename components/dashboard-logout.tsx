"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function DashboardLogoutButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => signOut({ callbackUrl: "/auth/login" })}
      className="gap-2"
    >
      <LogOut className="h-4 w-4" />
      Logout
    </Button>
  );
}
