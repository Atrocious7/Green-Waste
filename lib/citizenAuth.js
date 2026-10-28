import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import User from "@/models/User";
/** Checks the current database role instead of trusting the role cached in a JWT. */
export async function getAuthenticatedCitizen(forbiddenMessage = "Forbidden. Citizen account credentials required.") {
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
    try {
        await dbConnect();
        const citizen = await User.findById(session.user.id).select("role greenCoins").lean();
        if (!citizen) {
            return {
                errorResponse: NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 }),
            };
        }
        if (citizen.role !== "citizen") {
            return {
                errorResponse: NextResponse.json({ error: forbiddenMessage }, { status: 403 }),
            };
        }
        return { user: session.user, citizen };
    }
    catch (error) {
        console.error("[citizenAuth] Error verifying citizen session:", error);
        return {
            errorResponse: NextResponse.json({ error: "Internal server error verifying citizen permissions." }, { status: 500 }),
        };
    }
}
