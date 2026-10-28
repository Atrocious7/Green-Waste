import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import User from "@/models/User";
/**
 * Validates the current session for an admin role and resolves
 * the corresponding User document.
 * Guards against stale JWT role claims by re-verifying against MongoDB.
 */
export async function getAuthenticatedAdmin() {
    let session;
    try {
        session = await getServerSession(authOptions);
    }
    catch {
        return {
            errorResponse: NextResponse.json({ error: "Unable to verify your session." }, { status: 500 }),
        };
    }
    if (!session?.user?.id) {
        return {
            errorResponse: NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 }),
        };
    }
    const sessionUser = session.user;
    try {
        await dbConnect();
        const dbUser = await User.findById(sessionUser.id);
        if (!dbUser) {
            return {
                errorResponse: NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 }),
            };
        }
        if (dbUser.role !== "admin") {
            return {
                errorResponse: NextResponse.json({ error: "Forbidden. Administrator credentials required." }, { status: 403 }),
            };
        }
        return {
            user: sessionUser,
            dbUser,
        };
    }
    catch (error) {
        console.error("[adminAuth] Error verifying admin session:", error);
        return {
            errorResponse: NextResponse.json({ error: "Internal server error verifying admin permissions." }, { status: 500 }),
        };
    }
}
