import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/adminAuth";
import dbConnect from "@/lib/db";
import Business from "@/models/Business";
import User from "@/models/User";
export async function GET(_req, props) {
    const auth = await getAuthenticatedAdmin();
    if (auth.errorResponse) {
        return auth.errorResponse;
    }
    const { id } = await props.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ error: "Invalid business ID format." }, { status: 400 });
    }
    try {
        await dbConnect();
        void User;
        const business = await Business.findById(id).populate("userId", "email name").lean();
        if (!business) {
            return NextResponse.json({ error: "Business not found." }, { status: 404 });
        }
        const user = business.userId;
        return NextResponse.json({
            business: {
                id: String(business._id),
                businessName: business.businessName,
                email: business.email,
                userEmail: user?.email ?? business.email,
                userName: user?.name ?? "",
                address: business.address ?? "",
                description: business.description ?? "",
                verified: business.verified,
                suspended: business.suspended,
                createdAt: business.createdAt,
                updatedAt: business.updatedAt,
            },
        });
    }
    catch (error) {
        console.error("Failed to fetch business:", error);
        return NextResponse.json({ error: "Unable to retrieve business details." }, { status: 500 });
    }
}
export async function PATCH(req, props) {
    const auth = await getAuthenticatedAdmin();
    if (auth.errorResponse) {
        return auth.errorResponse;
    }
    const { id } = await props.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ error: "Invalid business ID format." }, { status: 400 });
    }
    try {
        const body = await req.json();
        const { verified, suspended } = body;
        if (verified !== undefined && typeof verified !== "boolean") {
            return NextResponse.json({ error: "Invalid request. 'verified' must be a boolean value." }, { status: 400 });
        }
        if (suspended !== undefined && typeof suspended !== "boolean") {
            return NextResponse.json({ error: "Invalid request. 'suspended' must be a boolean value." }, { status: 400 });
        }
        if (verified === undefined && suspended === undefined) {
            return NextResponse.json({ error: "No valid fields provided for update. Supply 'verified' and/or 'suspended' as booleans." }, { status: 400 });
        }
        await dbConnect();
        const business = await Business.findById(id);
        if (!business) {
            return NextResponse.json({ error: "Business not found." }, { status: 404 });
        }
        if (verified !== undefined) {
            business.verified = verified;
        }
        if (suspended !== undefined) {
            business.suspended = suspended;
        }
        await business.save();
        return NextResponse.json({
            message: "Business record updated successfully.",
            business: {
                id: String(business._id),
                businessName: business.businessName,
                email: business.email,
                address: business.address ?? "",
                description: business.description ?? "",
                verified: business.verified,
                suspended: business.suspended,
                updatedAt: business.updatedAt,
            },
        });
    }
    catch (error) {
        console.error("Failed to update business:", error);
        return NextResponse.json({ error: "Internal server error updating business." }, { status: 500 });
    }
}
