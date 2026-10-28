import dbConnect from "../lib/db.js";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import Business from "../models/Business.js";
import Reward from "../models/Reward.js";

async function seed() {
  await dbConnect();

  // create admin
  const adminEmail = "admin@greensort.local";
  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const admin = new User({
      name: "Admin",
      email: adminEmail,
      passwordHash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || "adminpass", 10),
      role: "admin",
      greenCoins: 0,
    });
    await admin.save();
    console.log("Created admin user:", adminEmail);
  }

  // create a business user + business
  const businessEmail = "cafe@greenbeans.local";
  let businessUser = await User.findOne({ email: businessEmail });
  if (!businessUser) {
    businessUser = new User({
      name: "Green Beans Cafe",
      email: businessEmail,
      passwordHash: await bcrypt.hash(process.env.SEED_BUSINESS_PASSWORD || "bizpass", 10),
      role: "business",
    });
    await businessUser.save();

    const biz = new Business({
      userId: businessUser._id,
      businessName: "Green Beans Cafe",
      email: businessEmail,
      address: "123 Eco St, Green City",
      description: "A local cafe offering discounts for eco-friendly citizens.",
      verified: true,
    });
    await biz.save();

    businessUser.business = biz._id;
    await businessUser.save();

    console.log("Created business user and profile:", businessEmail);

    // create rewards
    const r1 = new Reward({
      businessId: biz._id,
      title: "₹50 Café Discount",
      description: "Get ₹50 off your next purchase at Green Beans Cafe.",
      coinCost: 500,
      quantity: 50,
    });
    await r1.save();

    const r2 = new Reward({
      businessId: biz._id,
      title: "Free Coffee",
      description: "Redeem for one free regular coffee.",
      coinCost: 200,
      quantity: 100,
    });
    await r2.save();

    console.log("Created sample rewards for business.");
  }

  // create a demo citizen
  const citizenEmail = "user@citizen.local";
  let citizen = await User.findOne({ email: citizenEmail });
  if (!citizen) {
    citizen = new User({
      name: "Demo User",
      email: citizenEmail,
      passwordHash: await bcrypt.hash(process.env.SEED_CITIZEN_PASSWORD || "userpass", 10),
      role: "citizen",
      greenCoins: 1200,
    });
    await citizen.save();
    console.log("Created demo citizen:", citizenEmail);
  }

  console.log("Seeding complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});