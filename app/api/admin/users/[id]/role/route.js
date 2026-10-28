import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/adminAuth";
import dbConnect from "@/lib/db";
import AdminRoleGuard from "@/models/AdminRoleGuard";
import User from "@/models/User";
export async function PATCH(req, { params }) {
    const auth = await getAuthenticatedAdmin();
    if (auth.errorResponse) {
        return auth.errorResponse;
    }
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ error: "Invalid user ID format." }, { status: 400 });
    }
    try {
        const body = await req.json();
        const { role } = body;
        if (!["citizen", "business", "admin"].includes(role)) {
            return NextResponse.json({ error: "Invalid role specified. Role must be citizen, business, or admin." }, { status: 400 });
        }
        await dbConnect();
        // Ensure the shared transaction lock exists before role changes begin.
        // Its _id is unique, and every role-change transaction writes this same row.
        await AdminRoleGuard.updateOne({ _id: "admin-role-changes" }, { $setOnInsert: { version: 0 } }, { upsert: true });
        const session = await mongoose.startSession();
        let targetUser = null;
        try {
            const updatedUser = await session.withTransaction(async () => {
                // This shared write serializes concurrent role changes. A losing
                // transaction retries with a fresh snapshot before recounting admins.
                const guard = await AdminRoleGuard.findOneAndUpdate({ _id: "admin-role-changes" }, { $inc: { version: 1 } }, { new: true, session });
                if (!guard)
                    throw new Error("Admin role change guard is unavailable.");
                const userToUpdate = await User.findById(id).session(session);
                if (!userToUpdate) {
                    const error = new Error("User not found.");
                    error.statusCode = 404;
                    throw error;
                }
                if (userToUpdate.role === "admin" && role !== "admin") {
                    const adminCount = await User.countDocuments({ role: "admin" }).session(session);
                    if (adminCount <= 1) {
                        const error = new Error("Cannot demote or remove the last remaining administrator.");
                        error.statusCode = 400;
                        throw error;
                    }
                }
                userToUpdate.role = role;
                await userToUpdate.save({ session });
                return userToUpdate;
            });
            targetUser = updatedUser;
        }
        catch (error) {
            if (error.statusCode) {
                return NextResponse.json({ error: error.message }, { status: error.statusCode });
            }
            throw error;
        }
        finally {
            await session.endSession();
        }
        if (!targetUser) {
            return NextResponse.json({ error: "Unable to update user role." }, { status: 500 });
        }
        return NextResponse.json({
            message: `User role successfully updated to ${role}.`,
            user: {
                id: String(targetUser._id),
                name: targetUser.name,
                email: targetUser.email,
                role: targetUser.role,
                greenCoins: targetUser.greenCoins ?? 0,
                createdAt: targetUser.createdAt,
            },
        });
    }
    catch (error) {
        console.error("Failed to update user role:", error);
        return NextResponse.json({ error: "Internal server error updating user role." }, { status: 500 });
    }
}
