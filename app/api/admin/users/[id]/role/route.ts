import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedAdmin } from "@/lib/adminAuth";
import dbConnect from "@/lib/db";
import User from "@/models/User";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      return NextResponse.json(
        { error: "Invalid role specified. Role must be citizen, business, or admin." },
        { status: 400 }
      );
    }

    await dbConnect();
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Safety check: Cannot demote the last administrator
    if (targetUser.role === "admin" && role !== "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot demote or remove the last remaining administrator." },
          { status: 400 }
        );
      }
    }

    targetUser.role = role;
    await targetUser.save();

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
  } catch (error) {
    console.error("Failed to update user role:", error);
    return NextResponse.json({ error: "Internal server error updating user role." }, { status: 500 });
  }
}
