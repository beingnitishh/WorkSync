import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const allowedEmails = (process.env.WORKSYNC_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function readGoogleProfile(profile: unknown) {
  if (typeof profile !== "object" || profile === null) {
    return { email: "", emailVerified: false };
  }

  const googleProfile = profile as {
    email?: unknown;
    email_verified?: unknown;
  };

  return {
    email:
      typeof googleProfile.email === "string"
        ? googleProfile.email.toLowerCase()
        : "",
    emailVerified: googleProfile.email_verified === true,
  };
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  pages: {
    signIn: "/",
    error: "/",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;

      const { email, emailVerified } = readGoogleProfile(profile);
      if (!email || !emailVerified) return false;
      if (allowedEmails.length > 0 && !allowedEmails.includes(email)) return false;

      return true;
    },
  },
};
