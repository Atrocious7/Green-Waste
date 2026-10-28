import { NextResponse } from "next/server";
import { hash } from "bcrypt";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import Business from "@/models/Business";
function isDuplicateEmailError(error) {
    if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 11000) {
        return false;
    }
    return Boolean(error.keyPattern?.email ||
        error.keyValue?.email ||
        error.message?.includes("email_1"));
}
export async function POST(req) {
    try {
        const body = await req.json();
        const { name, email, password, role } = body;
        // Validate required fields
        if (!name || !email || !password) {
            return NextResponse.json({ error: "Name, email, and password are required." }, { status: 400 });
        }
        // Only allow citizen and business roles from public registration
        const allowedRoles = ["citizen", "business"];
        const userRole = allowedRoles.includes(role) ? role : "citizen";
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
        }
        // Validate password length
        if (password.length < 6) {
            return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
        }
        await dbConnect();
        const normalizedEmail = email.toLowerCase().trim();
        // Check for an existing account early; the unique index handles races.
        const existing = await User.findOne({ email: normalizedEmail }).select("_id").lean();
        if (existing) {
            return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
        }
        // Hash password
        const passwordHash = await hash(password, 10);
        // Create user
        const userFields = {
            name: name.trim(),
            email: normalizedEmail,
            passwordHash,
            role: userRole,
            greenCoins: 0,
        };
        if (userRole === "business") {
            await dbConnect();
            const dbSession = await mongoose.startSession();
            try {
                await dbSession.withTransaction(async () => {
                    const [user] = await User.create([userFields], { session: dbSession });
                    const [business] = await Business.create([
                        {
                            userId: user._id,
                            businessName: name.trim(),
                            email: normalizedEmail,
                            verified: false,
                        },
                    ], { session: dbSession });
                    user.business = business._id;
                    await user.save({ session: dbSession });
                });
            }
            finally {
                await dbSession.endSession();
            }
        }
        else {
            await new User(userFields).save();
        }
        return NextResponse.json({ message: "Account created successfully. Please log in." }, { status: 201 });
    }
    catch (err) {
        if (isDuplicateEmailError(err)) {
            return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
        }
        console.error("Registration error:", err);
        return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
}
