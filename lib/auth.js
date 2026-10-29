/**
 * lib/auth.js
 *
 * Central authentication helpers for GreenSort API routes.
 *
 * Each exported function checks the NextAuth session cookie and then
 * re-reads the user's role from MongoDB. Re-reading from the database
 * is important: it means a stale JWT cannot grant access if the user's
 * role was changed by an admin after they logged in.
 *
 * Return shape on failure: { errorResponse }  — the caller returns this directly.
 * Return shape on success:  role-specific fields described on each function.
 */

import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Business from "@/models/Business";
import User from "@/models/User";

// ---------------------------------------------------------------------------
// Private helper — shared by all three role functions
// ---------------------------------------------------------------------------

/**
 * Reads the NextAuth session cookie and returns the session user object.
 * Returns { errorResponse } if the session is missing, broken, or has no user id.
 */
async function getSessionUser() {
  let session;
  try {
    session = await getServerSession(authOptions);
  } catch {
    return {
      errorResponse: NextResponse.json(
        { error: "Unable to verify your session." },
        { status: 500 }
      ),
    };
  }

  if (!session?.user?.id) {
    return {
      errorResponse: NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      ),
    };
  }

  return { sessionUser: session.user };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/**
 * Guards admin-only API routes.
 *
 * On failure: returns { errorResponse }.
 * On success: returns { user, dbUser }.
 *   user   — the session user object (id, name, email, role from JWT).
 *   dbUser — the full Mongoose User document from MongoDB.
 */
export async function getAuthenticatedAdmin() {
  const sessionResult = await getSessionUser();
  if (sessionResult.errorResponse) return sessionResult;
  const sessionUser = sessionResult.sessionUser;

  try {
    await dbConnect();
    const dbUser = await User.findById(sessionUser.id);
    if (!dbUser) {
      return {
        errorResponse: NextResponse.json(
          { error: "Unauthorized. Please log in." },
          { status: 401 }
        ),
      };
    }
    if (dbUser.role !== "admin") {
      return {
        errorResponse: NextResponse.json(
          { error: "Forbidden. Administrator credentials required." },
          { status: 403 }
        ),
      };
    }
    return { user: sessionUser, dbUser };
  } catch (error) {
    console.error("[adminAuth] Error verifying admin session:", error);
    return {
      errorResponse: NextResponse.json(
        { error: "Internal server error verifying admin permissions." },
        { status: 500 }
      ),
    };
  }
}

// ---------------------------------------------------------------------------
// Citizen
// ---------------------------------------------------------------------------

/**
 * Guards citizen-only API routes.
 *
 * On failure: returns { errorResponse }.
 * On success: returns { user, citizen }.
 *   user    — the session user object (id, name, email, role from JWT).
 *   citizen — plain object with { role, greenCoins } from MongoDB.
 *
 * @param {string} [forbiddenMessage] — custom 403 message for this route.
 */
export async function getAuthenticatedCitizen(
  forbiddenMessage = "Forbidden. Citizen account credentials required."
) {
  const sessionResult = await getSessionUser();
  if (sessionResult.errorResponse) return sessionResult;
  const sessionUser = sessionResult.sessionUser;

  try {
    await dbConnect();
    const citizen = await User.findById(sessionUser.id)
      .select("role greenCoins")
      .lean();
    if (!citizen) {
      return {
        errorResponse: NextResponse.json(
          { error: "Unauthorized. Please log in." },
          { status: 401 }
        ),
      };
    }
    if (citizen.role !== "citizen") {
      return {
        errorResponse: NextResponse.json(
          { error: forbiddenMessage },
          { status: 403 }
        ),
      };
    }
    return { user: sessionUser, citizen };
  } catch (error) {
    console.error("[citizenAuth] Error verifying citizen session:", error);
    return {
      errorResponse: NextResponse.json(
        { error: "Internal server error verifying citizen permissions." },
        { status: 500 }
      ),
    };
  }
}

// ---------------------------------------------------------------------------
// Business
// ---------------------------------------------------------------------------

/**
 * Guards business-only API routes.
 *
 * On failure: returns { errorResponse }.
 * On success: returns { user, business }.
 *   user     — the session user object (id, name, email, role from JWT).
 *   business — the Business Mongoose document owned by this user.
 *
 * businessId is never taken from client input — it is always resolved
 * from the server-side session and confirmed with an ownership check.
 */
export async function getAuthenticatedBusiness() {
  const sessionResult = await getSessionUser();
  if (sessionResult.errorResponse) return sessionResult;
  const user = sessionResult.sessionUser;

  // Step 1: confirm the user's role in the database.
  // This guards against stale JWT tokens where the session role may be wrong.
  try {
    await dbConnect();
    const dbUser = await User.findById(user.id).select("role").lean();
    if (!dbUser) {
      console.warn("[businessAuth] Session user not found in DB:", user.id);
      return {
        errorResponse: NextResponse.json(
          { error: "Unauthorized. Please log in." },
          { status: 401 }
        ),
      };
    }
    if (dbUser.role !== "business") {
      return {
        errorResponse: NextResponse.json(
          { error: "Forbidden. Business account credentials required." },
          { status: 403 }
        ),
      };
    }
  } catch (dbErr) {
    console.error("[businessAuth] DB user lookup failed:", dbErr);
    return {
      errorResponse: NextResponse.json(
        { error: "Internal server error verifying credentials." },
        { status: 500 }
      ),
    };
  }

  // Step 2: resolve the Business document owned by this user.
  try {
    let business = null;

    // Try the businessId stored in the session first (fast path).
    // Always verify ownership with userId to prevent ID substitution.
    if (user.businessId && mongoose.Types.ObjectId.isValid(user.businessId)) {
      business = await Business.findOne({
        _id: user.businessId,
        userId: user.id,
      });
    }

    // Fallback: look up by userId directly.
    // Handles the case where the session businessId is stale or missing.
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
    console.error("[businessAuth] Failed to resolve business profile:", error);
    return {
      errorResponse: NextResponse.json(
        { error: "Internal server error resolving business profile." },
        { status: 500 }
      ),
    };
  }
}
