import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Business, { IBusiness } from "@/models/Business";
import User from "@/models/User";

interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  businessId?: string | null;
}

export type BusinessAuthResult =
  | {
      business: IBusiness;
      user: SessionUser;
      errorResponse?: never;
    }
  | {
      business?: never;
      user?: never;
      errorResponse: NextResponse;
    };

/**
 * Validates the current session for a business role and resolves
 * the corresponding Business document owned by that user.
 * Guarantees that businessId is never taken from untrusted client input.
 */
export async function getAuthenticatedBusiness(): Promise<BusinessAuthResult> {
  let session;
  try {
    session = await getServerSession(authOptions);
  } catch {
    return {
      errorResponse: NextResponse.json({ error: "Unable to verify your session." }, { status: 500 }),
    };
  }

  if (!session?.user?.id) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 }),
    };
  }

  const user = session.user as SessionUser;

  // Resolve the authoritative role from the database.
  // This guards against stale or missing JWT token.user fields: NextAuth v4
  // auto-maps token.sub → session.user.id regardless of whether token.user
  // was set, so the id check above can pass while role is undefined.
  let resolvedRole: string | null | undefined = user.role;
  try {
    await dbConnect();
    const dbUser = await User.findById(user.id).select("role").lean();
    if (!dbUser) {
      console.warn("[businessAuth] Session user not found in DB:", user.id);
      return {
        errorResponse: NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 }),
      };
    }
    resolvedRole = dbUser.role;
  } catch (dbErr) {
    console.error("[businessAuth] DB user lookup failed:", dbErr);
    return {
      errorResponse: NextResponse.json({ error: "Internal server error verifying credentials." }, { status: 500 }),
    };
  }

  if (resolvedRole !== "business") {
    return {
      errorResponse: NextResponse.json(
        { error: "Forbidden. Business account credentials required." },
        { status: 403 }
      ),
    };
  }

  try {
    // dbConnect() was already called above; calling again is a no-op (cached connection).

    // Look up by session.user.businessId first if valid, with strict userId ownership check
    let business: IBusiness | null = null;
    if (user.businessId && mongoose.Types.ObjectId.isValid(user.businessId)) {
      business = await Business.findOne({
        _id: user.businessId,
        userId: user.id,
      });
    }

    // Fallback: look up by user ID directly to ensure profile is found
    if (!business) {
      business = await Business.findOne({ userId: user.id });
    }

    if (!business) {
      return {
        errorResponse: NextResponse.json(
          { error: "No business profile associated with this account." },
          { status: 404 }
        ),
      };
    }

    return { business, user };
  } catch (error) {
    console.error("Failed to authenticate business:", error);
    return {
      errorResponse: NextResponse.json(
        { error: "Internal server error resolving business profile." },
        { status: 500 }
      ),
    };
  }
}
