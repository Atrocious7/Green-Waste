# Chapter 05 — Complete API Reference & Implementation Guide

This chapter documents every API route in `app/api/`: **23 route files** across Citizen, Business, and Admin domains (2,435 lines in total). Each endpoint is presented with its HTTP method, authorization level, request/response contract, and a block-by-block implementation analysis.

> `app/api/transactions/route.js` has been deleted. Transaction history is served by the React Server Component `app/dashboard/transactions/page.jsx`, which queries MongoDB directly; nothing fetches `/api/transactions` any more. If an older commit is shown during your viva, explain that the endpoint was a duplicate data path.

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
- **Explanation:** Ensures the file is non-empty, $\le 5\text{ MB}$ (`MAX_UPLOAD_SIZE_BYTES`, default `5242880`), has both a whitelisted MIME type (`image/jpeg`, `image/png`, `image/webp`, `image/gif`) **and** a whitelisted extension (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`), then pipes the binary Buffer into Cloudinary's upload stream. The route also refuses to start unless all three `CLOUDINARY_*` variables are set, and returns 500 if `MAX_UPLOAD_SIZE_BYTES` is not a positive number.

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
- **Explanation:** Calls `classifyWasteImage` with the Cloudinary URL. On failure the uploaded image is destroyed immediately so no orphaned asset remains in Cloudinary storage. The error class decides the response: `OpenRouterConfigurationError` → 503 *"AI image classification is not configured."*, `WasteClassificationCapacityError` → 503 with the error message, anything else → 502 (in development the 502 body also tells you to check the server terminal, where `lib/ai.js` has logged its sanitised OpenRouter diagnostic).

#### Block 4: Two Save Paths — Plain Insert vs. Atomic Reward Awarding

After classification the route decides which save path to use:

```javascript
const approved = classification.confidence >= DEFAULT_CONFIDENCE_THRESHOLD;
const coinsAwarded = approved ? COIN_MAPPING[classification.category] : 0;

const submissionFields = {
    userId: auth.user.id,
    idempotencyKey,
    imageUrl: uploadedImage.secure_url,
    predictedLabels: [],
    category: classification.category,
    confidence: classification.confidence,
    coinsAwarded,
    status: approved ? "approved" : "needs_review",
};

if (!approved || coinsAwarded === 0) {
    // No coins: plain insert, still protected by the unique idempotency index
    const createdSubmission = await WasteSubmission.create(submissionFields);
    return NextResponse.json({ message: "Waste submission created successfully.", submissionId: createdSubmission._id }, { status: 201 });
}
// Coins: replica-set transaction
sessionDb = await mongoose.startSession();
await sessionDb.withTransaction(async () => {
    const [createdSubmission] = await WasteSubmission.create([submissionFields], { session: sessionDb });
    const submission = await WasteSubmission.findOne({
        _id: createdSubmission._id,
        userId: auth.user.id,
        status: "approved",
        coinsAwarded: { $gt: 0 },
        rewardProcessed: { $ne: true },
    }).session(sessionDb);
    if (!submission) throw new Error("New submission was not eligible for reward processing.");
    const updatedUser = await User.findOneAndUpdate(
        { _id: submission.userId, role: "citizen", greenCoins: { $gte: 0 } },
        { $inc: { greenCoins: submission.coinsAwarded } },
        { new: true, runValidators: true, session: sessionDb }
    );
    if (!updatedUser) throw new Error("Citizen balance could not be updated.");
    await Transaction.create([{ /* type: "award", amount, referenceId, balanceAfter */ }], { session: sessionDb });
    submission.rewardProcessed = true;
    await submission.save({ session: sessionDb });
});
```
- **Explanation:**
  1. A submission only enters the transaction when it is approved **and** its category is worth coins (`coinsAwarded > 0`). Low confidence, a low-confidence verdict, or the `Non-recyclable` category (0 coins) all take the cheap plain-insert path with `status: "needs_review"`.
  2. Inside the transaction the freshly created document is re-read with an eligibility filter (`status: "approved"`, `coinsAwarded > 0`, `rewardProcessed: { $ne: true }`) before any coins move. This makes a double award impossible even if two requests somehow reached this point.
  3. The ledger row is inserted *after* the balance increment, so `balanceAfter` is the true post-award balance, and `rewardProcessed = true` is written last.
  4. If MongoDB transactions are not supported (standalone mongod), `isTransactionUnsupportedError` (`code === 20` or the driver's replica-set message) returns HTTP 503 instead of partially awarding.
  5. Both save paths convert a duplicate-key error (`code === 11000`) into an idempotent response: re-read the existing submission via `findExistingSubmissionId(userId, idempotencyKey)` and return HTTP 200 with its id, or — if the competing request has not committed yet — HTTP 409 *"This upload is already being processed. Retry the same request shortly."* The upload is deleted from Cloudinary on both failure paths.

#### Endpoint status codes at a glance

| Status | When |
| :--- | :--- |
| 200 | Replay: this `(userId, idempotencyKey)` already has a submission (`"This submission was already received."`). |
| 201 | Submission created, with or without coins. |
| 400 | Missing/malformed `Idempotency-Key`, unreadable form data, not a `File`, bad MIME/extension, or 0-byte file. |
| 413 | File exceeds `MAX_UPLOAD_SIZE_BYTES`. |
| 409 | Duplicate key raised while the winning request is still uncommitted. |
| 500 | Preparation failure (DB/`init()`), invalid threshold, invalid coin mapping, or the transaction write failed. |
| 502 | Cloudinary upload failure, AI returned no secure URL, or OpenRouter classification failed. |
| 503 | Cloudinary not configured, OpenRouter not configured, AI providers at capacity, or transactions unsupported. |

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

- **Status codes:** 201 on a fresh redemption, 200 on an idempotent replay of the same `(userId, idempotencyKey)` + `rewardId`, 409 if that key was used for a *different* reward or the voucher code collides, 400 for a bad key, unreadable body, invalid `rewardId`, unverified/suspended merchant, out-of-stock reward, insufficient coins, or a failed guarded decrement, 404 when the citizen or reward no longer exists inside the transaction, and 500 for a preparation failure.
- **Note on guards:** the route re-fetches the citizen, reward, and business *inside* the transaction and only then performs the two guarded `findOneAndUpdate` calls, so the pre-checks give friendly messages while the atomic updates are what actually protect the data.

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

- **Why the guard document is upserted first:** `AdminRoleGuard.updateOne({ _id: "admin-role-changes" }, { $setOnInsert: { version: 0 } }, { upsert: true })` runs *outside* the transaction so the lock row always exists — `findOneAndUpdate` inside a transaction would otherwise return `null` on a fresh database.
- **Error mapping:** errors thrown inside the transaction that carry `statusCode` (404 user not found, 400 last-admin) are returned with that code and message; anything else falls through to the generic 500 *"Internal server error updating user role."*

---

## 3. Remaining Endpoints — Compact Reference

The routes below follow the same shape as the deep-dives (guard → validate → query → `try/catch` → `NextResponse.json`), so only their distinguishing behaviour is listed.

### Citizen & public

| Endpoint | Behaviour worth remembering |
| :--- | :--- |
| `POST /api/auth/register` | Public. Accepts only `citizen`/`business` (anything else silently becomes `citizen`); validates email format and a 6-character minimum password; normalises the email with `toLowerCase().trim()`; pre-checks for a duplicate and still maps a racing `11000` on `email_1` to 409. A **business** registration creates `User` + `Business` inside one transaction and saves `user.business`; a citizen registration is a plain `new User(...).save()`. 201 on success. |
| `GET /api/rewards` | Citizen. `Reward.find({ status: "active", quantity: { $gt: 0 } })` + `populate({ path: "businessId", match: { verified: true, suspended: { $ne: true } } })`; rows whose `businessId` came back `null` (unverified/suspended partner) are filtered out. Returns `{ userCoins, rewards }`, sorted by `coinCost` ascending. |
| `GET /api/redemptions` | Citizen. Populates `rewardId` (`title description coinCost`) and `businessId` (`businessName address`), newest first. Returns a flat `redemptions` array with snapshots already stored on the document. |

### Business (all use `getAuthenticatedBusiness`)

| Endpoint | Behaviour worth remembering |
| :--- | :--- |
| `GET /api/business/dashboard` | Two `countDocuments` + two `aggregate` pipelines for stock and coins, all in one `Promise.all`. Returns `{ business, stats }` where stats include `activeRewardsCount`, `totalRewardsCount`, `totalAvailableStock`, `redeemedCount`, `pendingCount`, `totalCoinsClaimed`. "Redeemed" means `status` in `["redeemed", "completed"]`. |
| `GET/PATCH /api/business/profile` | `PATCH` whitelists only `businessName`, `email`, `address`, `description` (each type-checked) and rejects an empty update with 400, so `verified`/`suspended` can never be self-assigned. |
| `GET/POST /api/business/rewards` | `GET` adds per-reward `totalRedemptions`/`completedRedemptions` from a `Redemption` aggregation. `POST` requires an integer `coinCost >= 1` and an integer `quantity >= 0`; the new reward always starts `status: "active"` and 201 is returned. |
| `PATCH/DELETE /api/business/rewards/[id]` | `PATCH` accepts `title`, `description`, `coinCost`, `quantity`, `status` (“active”/“inactive” only). Both handlers scope the query with `{ _id: id, businessId: business._id, status: { $ne: "deleted" } }` — ownership is enforced in the query itself, and a miss returns 404 rather than leaking that the reward exists. `DELETE` is a soft delete (`status: "deleted"`). |
| `GET /api/business/redemptions` | Every redemption for this business with the reward and customer populated, newest first. |
| `POST /api/business/vouchers/redeem` | 403 if the store is unverified/suspended. Uppercases the code, then: 404 unknown code, 403 code belongs to another business, 400 already redeemed/cancelled, 409 if the atomic `findOneAndUpdate({ status: "pending" })` lost a race. Success returns the customer name/email and reward details. |

### Admin (all use `getAuthenticatedAdmin`)

| Endpoint | Behaviour worth remembering |
| :--- | :--- |
| `GET /api/admin/dashboard` | Ten concurrent reads in one `Promise.all`: user/citizen/business counts, submission counts by status, a `$sum` of `greenCoins`, redemption count, plus the latest 5 submissions and redemptions. |
| `GET /api/admin/analytics` | Accepts `range=7d\|30d\|90d\|1y\|all` (unknown values → 400). Five aggregations: submissions by day, categories, statuses, award coins by day, redemption statuses; day series are capped with `$limit: 365`. |
| `GET /api/admin/users` | Search over name/email, optional role filter, pagination capped at `limit<=50`, `.select("-passwordHash")` so hashes never leave the server. |
| `PATCH /api/admin/users/[id]/role` | See the deep-dive above; 400 invalid id/role, 404 unknown user, 400 last-admin. |
| `GET /api/admin/business`, `GET/PATCH /api/admin/business/[id]` | Search + `verified`/`suspended` filters with pagination. `PATCH` only accepts booleans for `verified`/`suspended` and 400s when neither is supplied. `GET /[id]` also returns the owner's name and email. |
| `GET /api/admin/rewards`, `PATCH/DELETE /api/admin/rewards/[id]` | Listing supports `search` (title **or** business name), `businessId`, `status`, and validates `page`/`limit` (1–50). `PATCH` only toggles `active`/`inactive` and refuses to revive a `deleted` reward (409). `DELETE` soft-deletes. |
| `GET /api/admin/submissions` | Filters by `status`, `category`, or a citizen name/email search (translated to a `userId: { $in: [...] }` query), paginated, `userId` populated with name/email/balance. |
| `PATCH /api/admin/submissions/[id]/moderate` | Admin approve/reject inside a transaction: approve requires a real category with a non-zero coin mapping, then credits coins and writes the award ledger row; reject requires a non-empty `moderationNote`. Note the route derives its HTTP status by **matching substrings of the thrown error message** (`"already"`, `"coin reward"`/`"category"`, `"not found"`) — brittle, and the obvious place for the next cleanup batch. |
| `GET /api/admin/redemptions` | The reconciliation audit. Supports `search`, `businessId`, `status`, `from`/`to` (a `YYYY-MM-DD` end date is expanded to 23:59:59.999 UTC), and pagination. All `type: "redeem"` transactions for the page's redemptions are loaded in one query and grouped by `referenceId`; `auditRedemption()` then reports `inconsistent` (missing/duplicate transaction, wrong amount, wrong user, bad `balanceAfter`, missing reward or business) or `warning` (reward inactive, current cost differs from the historical `coinsUsed`, reward's business link changed, business now unverified/suspended), otherwise `consistent`. |
