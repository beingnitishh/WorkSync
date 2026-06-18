"use client";

import type { ReactNode } from "react";
import { useSession } from "next-auth/react";
import { SignInScreen } from "@/components/auth/SignInScreen";

function LoadingScreen() {
  return (
    <div className="min-h-svh bg-background flex flex-col items-center justify-center">
      <img
        src="/worksync-logo.png"
        alt="WorkSync Logo"
        className="w-20 h-20 rounded-2xl object-cover animate-pulse-soft"
      />
      <h1 className="text-2xl font-bold text-foreground mt-4 tracking-tight">WorkSync</h1>
      <p className="text-muted-foreground text-sm mt-1">Checking session...</p>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useSession();

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (status === "unauthenticated") {
    return <SignInScreen />;
  }

  return children;
}
