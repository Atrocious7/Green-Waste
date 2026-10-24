import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcrypt";
import dbConnect from "@/lib/db";
import User from "@/models/User";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* NextAuth callback types use Record<string, unknown> internally but custom
   fields (user.role, token.user, session.user) need casting. We disable the
   no-explicit-any rule for this file only because the alternative is a large
   amount of boilerplate type augmentation that adds no real safety here. */

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        await dbConnect();
        const user = await User.findOne({ email: credentials.email }).lean();
        if (!user) return null;

        const valid = await compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          business: user.business ? user.business.toString() : null,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user?: any }) {
      if (user) {
        token.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          businessId: user.business || null,
        };
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (token?.user) {
        // Primary path: token.user was set by the jwt() callback at sign-in.
        session.user = {
          id: token.user.id,
          name: token.user.name,
          email: token.user.email,
          role: token.user.role,
          businessId: token.user.businessId,
        };
      } else if (token?.sub) {
        // Fallback for stale cookies or edge cases where token.user was not set.
        // NextAuth v4 auto-maps token.sub → session.user.id; preserve any other
        // fields that may have been written directly onto the token.
        session.user = {
          ...session.user,
          id: token.sub,
          role: (token as any).role ?? null,
          businessId: (token as any).businessId ?? null,
        };
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };