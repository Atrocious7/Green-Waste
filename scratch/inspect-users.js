import dbConnect from "../lib/db.js";
import User from "../models/User.js";
import Business from "../models/Business.js";

async function inspectDb() {
  await dbConnect();

  const users = await User.find({}).lean();
  console.log("=== USERS IN DB ===");
  for (const u of users) {
    console.log({
      _id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
      business: u.business ? String(u.business) : null,
    });
  }

  const businesses = await Business.find({}).lean();
  console.log("=== BUSINESSES IN DB ===");
  for (const b of businesses) {
    console.log({
      _id: String(b._id),
      userId: String(b.userId),
      businessName: b.businessName,
      email: b.email,
    });
  }

  process.exit(0);
}

inspectDb().catch((err) => {
  console.error(err);
  process.exit(1);
});
