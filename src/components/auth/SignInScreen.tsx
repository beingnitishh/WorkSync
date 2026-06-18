"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignInScreen() {
  const [signingIn, setSigningIn] = useState(false);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    await signIn("google", { callbackUrl: "/" });
  };

  return (
    <div className="min-h-svh bg-background flex items-center justify-center px-4 py-8 overflow-hidden">
      <div className="w-full max-w-sm sm:max-w-md animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto mb-4 signature-shadow animate-pulse-soft">
            <img
              src="/worksync-logo.png"
              alt="WorkSync Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            WorkSync
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Sign in to open your attendance workspace.
          </p>
        </div>

        <div className="glass-card rounded-2xl p-5 sm:p-6 signature-shadow">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Secure access</p>
              <p className="text-xs text-muted-foreground">Continue with your Google account</p>
            </div>
          </div>

          <Button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="w-full rounded-[14px] h-12 text-sm font-semibold bg-primary hover:bg-primary/90 text-white btn-press"
          >
            {signingIn ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <span className="w-5 h-5 mr-2 rounded-full bg-white text-primary font-bold text-sm flex items-center justify-center">
                G
              </span>
            )}
            {signingIn ? "Opening Google..." : "Sign in with Google"}
            {!signingIn && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
