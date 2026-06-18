import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/components/auth/AuthProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#004ac6",
};

export const metadata: Metadata = {
  title: "WorkSync - Office Attendance Tracker",
  description: "Track your office attendance, manage Sunday patterns, and calculate salary effortlessly with WorkSync.",
  keywords: ["WorkSync", "Attendance", "Salary", "Office Tracker"],
  authors: [{ name: "WorkSync" }],
  icons: {
    icon: "/worksync-logo.png",
    apple: "/worksync-logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WorkSync",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased bg-background text-foreground"
        style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <AuthProvider>{children}</AuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
