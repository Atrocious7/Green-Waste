import { NextResponse } from "next/server";
import { hash } from "bcrypt";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import Business from "@/models/Business";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, role } = body;

    // Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    // Only allow citizen and business roles from public registration
    const allowedRoles = ["citizen", "business"];
    const userRole = allowedRoles.includes(role) ? role : "citizen";

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    await dbConnect();

    // Check for duplicate email
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hash(password, 10);

    // Create user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: userRole,
      greenCoins: 0,
    });
    await user.save();

    // If business role, create a Business profile stub
    if (userRole === "business") {
      const biz = new Business({
        userId: user._id,
        businessName: name.trim(),
        email: email.toLowerCase().trim(),
        verified: false,
      });
      await biz.save();
      user.business = biz._id;
      await user.save();
    }

    return NextResponse.json(
      { message: "Account created successfully. Please log in." },
      { status: 201 }
    );
  } catch (err) {
    console.error("Registration error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}