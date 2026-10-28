# Chapter 05 — Complete API Reference & Implementation Guide

This chapter documents every API route discovered in `app/api/`. Each endpoint is presented with its HTTP method, authorization level, request/response contract, and detailed line-by-line implementation analysis.

---

## 1. Master API Endpoints Directory

| Method | Route Path | Access / Role | Primary Models | Purpose | Caller Component |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/register` | Public | `User`, `Business` | Creates citizen or business account (atomic transaction for businesses). | `RegisterPage` (`app/auth/register/page.jsx`) |
| **ALL** | `/api/auth/[...nextauth]` | Public | `User` | NextAuth v4 session, signin, signout, and JWT token rotation. | `LoginPage`, `DashboardLogoutButton` |
| **POST** | `/api/waste-submissions` | Citizen | `WasteSubmission`, `User`, `Transaction` | Receives image, uploads to Cloudinary, runs AI vision, awards Green Coins atomically. | `SubmitWastePage` (`app/dashboard/submit/page.jsx`) |
| **GET** | `/api/rewards` | Citizen | `Reward`, `Business` | Lists active rewards from verified, non-suspended merchants. | `RewardsPage` (`app/dashboard/rewards/page.jsx`) |
| **POST** | `/api/rewards/redeem` | Citizen | `Reward`, `User`, `Redemption`, `Transaction`, `Business` | Transactionally decrements stock, deducts coins, issues unique voucher code. | `RewardsPage` (`app/dashboard/rewards/page.jsx`) |
| **GET** | `/api/redemptions` | Citizen | `Redemption`, `Reward`, `Business` | Lists citizen's active and redeemed vouchers. | `RewardsPage` (`app/dashboard/rewards/page.jsx`) |
| **GET** | `/api/transactions` | Citizen | `Transaction` | Returns citizen's coin history ledger. | Available for client tables (`transactions/route.js`) |
| **GET** | `/api/business/dashboard` | Business | `Reward`, `Redemption`, `Business` | Returns merchant KPIs (active stock, vouchers redeemed, coins claimed). | `BusinessDashboardPage` (`app/business/dashboard/page.jsx`) |
| **GET** | `/api/business/profile` | Business | `Business` | Returns current merchant profile data. | `BusinessDashboardPage` |
| **PATCH**| `/api/business/profile` | Business | `Business` | Updates store name, email, address, description (cannot self-verify). | `BusinessDashboardPage` |
| **GET** | `/api/business/rewards` | Business | `Reward`, `Redemption` | Returns merchant's reward listings with individual redemption counts. | `BusinessDashboardPage` |
| **POST** | `/api/business/rewards` | Business | `Reward` | Creates a new reward for the authenticated business. | `BusinessDashboardPage` |
| **PATCH**| `/api/business/rewards/[id]` | Business | `Reward` | Updates title, cost, quantity, or status for merchant's own reward. | `BusinessDashboardPage` |
| **DELETE**| `/api/business/rewards/[id]`| Business | `Reward` | Soft-deletes reward (`status: "deleted"`). | `BusinessDashboardPage` |
| **GET** | `/api/business/redemptions` | Business | `Redemption`, `Reward`, `User` | Returns historical customer voucher redemptions for this store. | `BusinessDashboardPage` |
| **POST** | `/api/business/vouchers/redeem` | Business | `Redemption`, `Reward`, `User` | Verifies code and atomically marks voucher as redeemed. | `BusinessDashboardPage` |
| **GET** | `/api/admin/dashboard` | Admin | `User`, `WasteSubmission`, `Redemption`, `Reward` | High-level system statistics and latest activity feed. | `AdminDashboardPage` (`app/admin/dashboard/page.jsx`) |
| **GET** | `/api/admin/analytics` | Admin | `WasteSubmission`, `Transaction`, `Redemption` | Aggregates time-series charts (7d, 30d, 90d, 1y, all). | `AdminAnalyticsPage` (`app/admin/analytics/page.jsx`) |
| **GET** | `/api/admin/users` | Admin | `User` | Paginated user management list with role/search filtering. | `AdminUsersPage` (`app/admin/users/page.jsx`) |
| **PATCH**| `/api/admin/users/[id]/role`| Admin | `AdminRoleGuard`, `User` | Updates user role with optimistic lock and last-admin protection. | `AdminUsersPage` |
| **GET** | `/api/admin/business` | Admin | `Business`, `User` | Lists merchant partners with verification and suspension filters. | `AdminBusinessPage` (`app/admin/business/page.jsx`) |
| **GET** | `/api/admin/business/[id]` | Admin | `Business`, `User` | Fetches single business details with owner email. | `AdminBusinessPage` |
| **PATCH**| `/api/admin/business/[id]` | Admin | `Business` | Toggles `verified` or `suspended` flags for a merchant. | `AdminBusinessPage` |
| **GET** | `/api/admin/rewards` | Admin | `Reward`, `Business` | Global view of all rewards across all merchants. | `AdminRewardsPage` (`app/admin/rewards/page.jsx`) |
| **PATCH**| `/api/admin/rewards/[id]` | Admin | `Reward` | Toggles reward status (`active`/`inactive`). | `AdminRewardsPage` |
| **DELETE**| `/api/admin/rewards/[id]` | Admin | `Reward` | Soft-deletes reward from administrative console. | `AdminRewardsPage` |
| **GET** | `/api/admin/submissions` | Admin | `WasteSubmission`, `User` | Paginated list of waste submissions with filter by status/category. | `AdminSubmissionsPage` (`app/admin/submissions/page.jsx`) |
| **PATCH**| `/api/admin/submissions/[id]/moderate` | Admin | `WasteSubmission`, `User`, `Transaction` | Approves or rejects flagged submissions and credits coins. | `AdminSubmissionsPage` |
| **GET** | `/api/admin/redemptions` | Admin | `Redemption`, `Transaction`, `Reward`, `Business`, `User` | Cross-collection reconciliation audit verifying ledger integrity. | `AdminRedemptionsPage` (`app/admin/redemptions/page.jsx`) |

---

## 2. Core Endpoint Implementation Deep-Dive

---

### Endpoint: `POST /api/waste-submissions`
- **File:** `app/api/waste-submissions/route.js`
- **Purpose:** Handles waste image uploads, executes AI classification, and issues Green Coins atomically.

#### Block 1: Role Verification & Idempotency Key Validation
```javascript
const auth = await getAuthenticatedCitizen("Only citizens can submit waste.");
if (auth.errorResponse) return auth.errorResponse;

const idempotencyKey = request.headers.get("idempotency-key");
if (!idempotencyKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    return NextResponse.json({ error: "A valid submission request key is required." }, { status: 400 });
}
```
- **Explanation:** 
  1. `getAuthenticatedCitizen()` queries MongoDB to ensure the session caller is an active citizen.
  2. The server extracts the `idempotency-key` HTTP header and verifies it against a strict UUID RFC-4122 regex pattern. If missing or malformed, it immediately returns HTTP 400.

#### Block 2: File Validation & Cloudinary Stream Upload
```javascript
const maxUploadSizeBytes = Number(process.env.MAX_UPLOAD_SIZE_BYTES ?? 5 * 1024 * 1024);
if (file.size > maxUploadSizeBytes) {
    return NextResponse.json({ error: `Image must be ${maxUploadSizeBytes / (1024 * 1024)} MB or smaller.` }, { status: 413 });
}

let uploadedImage;
try {
    uploadedImage = await uploadImage(buffer);
} catch {
    return NextResponse.json({ error: "Image storage is temporarily unavailable. Please try again." }, { status: 502 });
}
```
- **Explanation:** Ensures the image is $\le 5\text{ MB}$, valid MIME type (`image/jpeg`, `image/png`, `image/webp`), and pipes the binary Buffer into Cloudinary's upload stream.

#### Block 3: AI Classification & Auto-Rollback
```javascript
let classification;
try {
    classification = await classifyWasteImage(uploadedImage.secure_url);
} catch (error) {
    await deleteUploadedImage(uploadedImage.public_id);
    if (error instanceof WasteClassificationCapacityError) {
        return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: "We could not classify this image right now. Please try again." }, { status: 502 });
}
```
- **Explanation:** Calls `classifyWasteImage` with the Cloudinary URL. If OpenRouter fails or models are busy, `deleteUploadedImage(uploadedImage.public_id)` is invoked immediately so no orphaned image remains in Cloudinary storage.

#### Block 4: Atomic Reward Awarding via Transaction
```javascript
const approved = classification.confidence >= DEFAULT_CONFIDENCE_THRESHOLD;
const coinsAwarded = approved ? COIN_MAPPING[classification.category] : 0;

sessionDb = await mongoose.startSession();
await sessionDb.withTransaction(async () => {
    const [createdSubmission] = await WasteSubmission.create([submissionFields], { session: sessionDb });
    const updatedUser = await User.findOneAndUpdate(
        { _id: submission.userId, role: "citizen", greenCoins: { $gte: 0 } },
        { $inc: { greenCoins: submission.coinsAwarded } },
        { new: true, runValidators: true, session: sessionDb }
    );
    await Transaction.create([
        {
            userId: submission.userId,
            type: "award",
            amount: submission.coinsAwarded,
            note: `Waste segregation reward - ${submission.category}`,
            referenceId: submission._id,
            balanceAfter: updatedUser.greenCoins,
        },
    ], { session: sessionDb });
    submission.rewardProcessed = true;
    await submission.save({ session: sessionDb });
});
```
- **Explanation:** 
  1. If `confidence >= 70%`, it begins a MongoDB replica-set transaction.
  2. Saves the submission, increments `user.greenCoins` by the category value (e.g., Plastic = 15), logs the ledger `Transaction` with `balanceAfter`, and sets `rewardProcessed = true`.
  3. If MongoDB transactions are not supported on the host (e.g., standalone Mongo without replica sets), it catches `isTransactionUnsupportedError` and responds with HTTP 503 instead of corrupting data.

---

### Endpoint: `POST /api/rewards/redeem`
- **File:** `app/api/rewards/redeem/route.js`
- **Purpose:** Atomically spends Green Coins, decrements merchant inventory, and creates a unique voucher.

#### Key Code Snippet:
```javascript
const outcome = await sessionDb.withTransaction(async () => {
  // 1. Idempotency replay check
  const existingRedemption = await Redemption.findOne({ userId: auth.user.id, idempotencyKey }).session(sessionDb);
  if (existingRedemption) {
    if (String(existingRedemption.rewardId) !== rewardId) throw new Error("Key conflict");
    return { redemption: makeRedemptionResponse(existingRedemption), replay: true };
  }

  // 2. Decrement stock with guarded condition
  const updatedReward = await Reward.findOneAndUpdate(
    { _id: reward._id, status: "active", quantity: { $gt: 0 } },
    { $inc: { quantity: -1 } },
    { session: sessionDb, new: true }
  );
  if (!updatedReward) throw new Error("Out of stock");

  // 3. Deduct citizen coins with balance guard
  const updatedCitizen = await User.findOneAndUpdate(
    { _id: citizen._id, role: "citizen", greenCoins: { $gte: reward.coinCost } },
    { $inc: { greenCoins: -reward.coinCost } },
    { session: sessionDb, new: true, runValidators: true }
  );
  if (!updatedCitizen) throw new Error("Insufficient Green Coins");

  // 4. Generate crypto voucher code
  const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
  const timeBase36 = Math.floor(Date.now() / 1000).toString(36).toUpperCase();
  const redemptionCode = `GS-${timeBase36}-${randomHex}`;

  // 5. Create Redemption & Transaction
  const [createdRedemption] = await Redemption.create([{
    userId: citizen._id,
    rewardId: reward._id,
    businessId: reward.businessId,
    coinsUsed: reward.coinCost,
    idempotencyKey,
    rewardTitleSnapshot: reward.title,
    businessNameSnapshot: business.businessName,
    balanceAfter: updatedCitizen.greenCoins,
    redemptionCode,
    status: "pending",
  }], { session: sessionDb });

  await Transaction.create([{
    userId: citizen._id,
    type: "redeem",
    amount: -reward.coinCost,
    referenceId: createdRedemption._id,
    note: `Redeemed reward: ${reward.title}`,
    balanceAfter: updatedCitizen.greenCoins,
  }], { session: sessionDb });

  return { redemption: makeRedemptionResponse(createdRedemption), replay: false };
});
```

---

### Endpoint: `POST /api/business/vouchers/redeem`
- **File:** `app/api/business/vouchers/redeem/route.js`
- **Purpose:** Point-of-sale voucher code verification by merchants.

#### Key Code Snippet:
```javascript
// Strict merchant ownership check
if (String(existing.businessId) !== String(business._id)) {
  return NextResponse.json(
    { error: "This voucher was issued for a different partner business." },
    { status: 403 }
  );
}

// Atomic status transition from "pending" to "redeemed"
const updated = await Redemption.findOneAndUpdate(
  { _id: existing._id, businessId: business._id, status: "pending" },
  { $set: { status: "redeemed" } },
  { new: true }
).populate("rewardId", "title").populate("userId", "name email");

if (!updated) {
  return NextResponse.json(
    { error: "Voucher was already redeemed or is being processed." },
    { status: 409 }
  );
}
```
- **Why this is critical for Viva:** The query checks `{ status: "pending" }` directly inside the atomic `findOneAndUpdate`. If two cashiers enter the same code simultaneously, only the first query matches. The second query finds no matching document and receives HTTP 409 Conflict, completely eliminating double-redemption race conditions without requiring an explicit transaction lock.

---

### Endpoint: `PATCH /api/admin/users/[id]/role`
- **File:** `app/api/admin/users/[id]/role/route.js`
- **Purpose:** Role modification with safety guards preventing admin lockout.

#### Key Code Snippet:
```javascript
// Step 1: Touch the shared lock document
const guard = await AdminRoleGuard.findOneAndUpdate(
  { _id: "admin-role-changes" },
  { $inc: { version: 1 } },
  { new: true, session }
);

// Step 2: Last admin guard
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
```
