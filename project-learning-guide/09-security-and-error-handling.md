# Chapter 09 — Security, Concurrency & Data Integrity

This chapter examines the security architecture, concurrency controls, and data integrity safeguards implemented in **GreenSort**.

---

## 1. Security Architecture Summary

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Layer 1: Edge & Network                         │
│  - Middleware JWT Route Filtering (middleware.js)                      │
│  - Cloudinary Whitelist remotePatterns in next.config.js               │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│                   Layer 2: Transport & Authentication                  │
│  - HTTP-Only, Secure SameSite Cookies (NextAuth)                       │
│  - Bcrypt 10 Salt-Round Password Hashing                               │
│  - Exclusion of passwordHash in User Queries (.select("-passwordHash"))│
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│                 Layer 3: Authoritative Database Guards                 │
│  - Real-time MongoDB Role Re-query (citizenAuth, businessAuth, admin)  │
│  - Strict Object Ownership Enforcement (reward.businessId === authId)  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│               Layer 4: Concurrency & Database Integrity                │
│  - MongoDB Replica Set Multi-Document Transactions                    │
│  - Partial Unique Compound Indexes (Idempotency Keys)                  │
│  - Atomic Guarded Increments ($gte Balance Checks)                     │
│  - Distributed Optimistic Version Locking (AdminRoleGuard)             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Authentication & Authorization Controls

### A. Two-Tiered Role Enforcement
GreenSort uses a defense-in-depth model with two distinct authorization checkpoints:

1. **Edge Checkpoint (`middleware.js`):** Inspects the NextAuth JWT before a **page** renders. Its matcher is `["/admin/:path*", "/business/:path*", "/dashboard/:path*", "/auth/:path*"]`, so it guards portals, not `/api/*`. Unauthenticated visitors are redirected to `/auth/login`; a signed-in user hitting another role's portal is redirected to `/`. Note that `/` is a public path and is checked first.
2. **Database Checkpoint (`lib/auth.js`, re-exported by `lib/citizenAuth.js` / `lib/businessAuth.js` / `lib/adminAuth.js`):** because `middleware.js` does **not** cover `/api/*`, this is the *only* authorization layer for API routes. Every sensitive handler starts by awaiting one of the guards, which queries MongoDB directly:
   ```javascript
   const citizen = await User.findById(session.user.id).select("role greenCoins").lean();
   if (citizen.role !== "citizen") return forbiddenResponse();
   ```
   *Why this is vital:* It eliminates the "stale JWT" vulnerability where a demoted user retains privileged access until their cookie expires. A forgotten guard on a new API route would therefore be an unauthenticated endpoint — the two-tier model only works because every handler opts in explicitly.

### B. Strict Business Ownership Scoping
When a merchant updates or deletes a reward, the database query does not simply search by `id`. It **strictly scopes by `businessId`**:
```javascript
const updated = await Reward.findOneAndUpdate(
  {
    _id: id,
    businessId: business._id, // Enforces ownership!
    status: { $ne: "deleted" },
  },
  { $set: updates },
  { new: true }
);
```
Even if an attacker discovers another store's reward ID, they cannot modify or delete it because `businessId` is derived exclusively from the authenticated session, never from client request bodies.

---

## 3. Financial & Coin Balance Integrity

### A. Guarded Atomic Decrements
In distributed web systems, a naive balance update like:
```javascript
// VULNERABLE TO RACE CONDITIONS (DO NOT USE)
const user = await User.findById(userId);
if (user.greenCoins >= cost) {
  user.greenCoins -= cost;
  await user.save();
}
```
can be exploited by dispatching 10 simultaneous requests, allowing a user with 500 coins to redeem five 500-coin rewards (spending 2,500 coins).

GreenSort prevents this using **guarded conditional database operations**:
```javascript
// GREENSORT IMPLEMENTATION (app/api/rewards/redeem/route.js)
const updatedCitizen = await User.findOneAndUpdate(
  {
    _id: citizen._id,
    role: "citizen",
    greenCoins: { $gte: reward.coinCost }, // Guard: Must have sufficient balance!
  },
  { $inc: { greenCoins: -reward.coinCost } },
  { session: sessionDb, new: true, runValidators: true }
);

if (!updatedCitizen) {
  throw new Error("Insufficient Green Coins to complete redemption.");
}
```
MongoDB's document-level write lock ensures that only requests with valid remaining balances succeed. Subsequent requests fail immediately.

### B. Min Validator & Double-Entry Ledger
- **Schema-Level Guard:** In `models/User.js`, `greenCoins` is defined with `min: 0`. Any database operation attempting to write a negative number throws a validation error.
- **Audit Ledger:** Every award and deduction writes a corresponding record to `Transaction`, storing `balanceAfter`. The sum of all transactions must reconcile with `user.greenCoins`.

---

## 4. Concurrency & Idempotency Guarantees

### A. Waste Submission Idempotency
- **Client Action:** When an image is uploaded, an RFC-4122 UUID is stored in `sessionStorage` and sent as `Idempotency-Key`.
- **Database Index:**
  ```javascript
  WasteSubmissionSchema.index(
    { userId: 1, idempotencyKey: 1 },
    {
      unique: true,
      partialFilterExpression: { idempotencyKey: { $type: "string" } },
      name: "unique_user_waste_submission_idempotency_key",
    }
  );
  ```
- **Replay Behavior:** a retry is caught at one of two points. The route first looks the key up before uploading (`findExistingSubmissionId`), so a replay normally returns HTTP 200 *"This submission was already received."* with the original id and **never calls Cloudinary or the AI**. If the duplicate only surfaces when the insert hits the unique index, the already-uploaded image is deleted and the route again returns 200 if the winning document is visible — or HTTP 409 *"This upload is already being processed. Retry the same request shortly."* if it is not. No path awards coins twice.

### B. POS Voucher Single-Use Guarantee
When a merchant redeems a customer code, it uses an atomic status check:
```javascript
const updated = await Redemption.findOneAndUpdate(
  {
    _id: existing._id,
    businessId: business._id,
    status: "pending", // Can only transition if currently pending!
  },
  { $set: { status: "redeemed" } },
  { new: true }
);
```
If two staff members scan the voucher simultaneously, only one succeeds; the second receives HTTP 409 Conflict.

### C. Admin Role Version Lock (`AdminRoleGuard`)
To prevent race conditions during admin role promotions and demotions, all role updates serialize through a single guard document:
```javascript
await AdminRoleGuard.findOneAndUpdate(
  { _id: "admin-role-changes" },
  { $inc: { version: 1 } },
  { new: true, session }
);
```
MongoDB replica sets detect write conflicts on this row, forcing concurrent admin role updates into a strict queue.

---

## 5. Potential Limitations & Real-World Edge Cases

During code inspection, the following technical constraints were identified:

1. **MongoDB Replica Set Dependency:** Multi-document transactions (`session.withTransaction`) require a MongoDB replica set (standard on MongoDB Atlas, but requires `--replSet` on a local mongod). Only `/api/waste-submissions` maps that condition to a friendly 503 via `isTransactionUnsupportedError`; registration, redemption, moderation, and role changes let the driver error surface as their generic 500 messages. On a standalone server those flows will fail rather than silently corrupt data.
2. **OpenRouter Free Model Availability:** The AI classification pipeline relies on free multimodal vision models. If all three verified models are rate-limited at once, the request responds with HTTP 503 (`WasteClassificationCapacityError`) and all models cool down for 45 seconds.
3. **Session Cookie Lifespan:** NextAuth sessions are stored in JWT cookies. While API routes check real-time database state, client-side UI labels (such as the name in a header) only refresh on token refresh or navigation.
4. **`moderationNote` is not persisted:** the moderation route assigns `submission.moderationNote`, but `WasteSubmissionSchema` does not declare that field, so Mongoose `strict` mode drops it. The note survives only inside the award `Transaction.note`. A rejection reason therefore has no home yet — an honest limitation to state if asked.
5. **Admin moderation status mapping is string-based:** the moderate route decides 400 vs 404 by testing `error.message.includes("already")`, `.includes("coin reward")`, `.includes("category")`, and `.includes("not found")`. It behaves correctly for the current messages but is easy to break by rephrasing an error.
6. **In-memory cooldown map is per-process:** `modelCooldownMap` lives in module memory. With multiple server instances each keeps its own cooldown state (and a serverless cold start resets it), which is acceptable for a college deployment but not a distributed rate-limiter.
