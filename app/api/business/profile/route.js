import { NextResponse } from "next/server";
import { getAuthenticatedBusiness } from "@/lib/businessAuth";
import Business from "@/models/Business";
export async function GET() {
    const auth = await getAuthenticatedBusiness();
    if (auth.errorResponse) {
        return auth.errorResponse;
    }
    const { business } = auth;
    return NextResponse.json({
        business: {
            id: String(business._id),
            businessName: business.businessName,
            email: business.email,
            address: business.address ?? "",
            description: business.description ?? "",
            verified: business.verified,
            createdAt: business.createdAt,
            updatedAt: business.updatedAt,
        },
    });
}
export async function PATCH(request) {
    const auth = await getAuthenticatedBusiness();
    if (auth.errorResponse) {
        return auth.errorResponse;
    }
    const { business } = auth;
    let body;
    try {
        body = await request.json();
    }
    catch {
        return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }
    const { businessName, address, description, email } = body || {};
    const updates = {};
    if (businessName !== undefined) {
        if (typeof businessName !== "string" || businessName.trim().length === 0) {
            return NextResponse.json({ error: "Business name cannot be empty." }, { status: 400 });
        }
        updates.businessName = businessName.trim();
    }
    if (email !== undefined) {
        if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
        }
        updates.email = email.trim().toLowerCase();
    }
    if (address !== undefined) {
        if (typeof address !== "string") {
            return NextResponse.json({ error: "Address must be a string." }, { status: 400 });
        }
        updates.address = address.trim();
    }
    if (description !== undefined) {
        if (typeof description !== "string") {
            return NextResponse.json({ error: "Description must be a string." }, { status: 400 });
        }
        updates.description = description.trim();
    }
    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: "No valid profile fields provided for update." }, { status: 400 });
    }
    try {
        const updated = await Business.findByIdAndUpdate(business._id, { $set: updates }, { new: true, runValidators: true });
        if (!updated) {
            return NextResponse.json({ error: "Business not found." }, { status: 404 });
        }
        return NextResponse.json({
            message: "Business profile updated successfully.",
            business: {
                id: String(updated._id),
                businessName: updated.businessName,
                email: updated.email,
                address: updated.address ?? "",
                description: updated.description ?? "",
                verified: updated.verified,
                updatedAt: updated.updatedAt,
            },
        });
    }
    catch (error) {
        console.error("Failed to update business profile:", error);
        return NextResponse.json({ error: "Unable to update profile." }, { status: 500 });
    }
}
