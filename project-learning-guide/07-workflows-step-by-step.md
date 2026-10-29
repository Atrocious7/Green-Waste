# Chapter 07 — End-to-End Workflows Step by Step

This chapter traces the 13 essential workflows of **GreenSort** from the user's initial browser click, through Next.js middleware and API routes, down to the database operations and UI updates.

---

## Workflow 1: Citizen Registration and Login

1. **User Action:** The user navigates to `/auth/register`, enters their full name, email, password, and selects "Citizen".
2. **Client Validation:** React Hook Form and Zod (`registerSchema`) validate that the email is syntactically correct and passwords match.
3. **API Call:** A `POST` request is sent to `/api/auth/register` with `{ name, email, password, role: "citizen" }`.
4. **Backend Processing:**
   - Normalises the email to lowercase/trimmed and checks for a duplicate with `User.findOne({ email }).select("_id")` — a racing duplicate is still caught by the unique index and mapped to 409.
   - Hashes the password using `bcrypt.hash(password, 10)`.
   - For a **citizen**: saves one `User` document with `role: "citizen"` and `greenCoins: 0`.
   - For a **business**: opens a transaction and creates the `User` + a `Business` profile (`verified: false`), then stores the `Business` id on the user — an orphaned user account can never be left behind.
5. **Redirection to Login:** Client receives HTTP 201 and redirects to `/auth/login`.
6. **Sign In Execution:** User enters credentials and clicks "Sign In".
   - `signIn("credentials", { email, password, redirect: false })` is called.
   - Handled by `app/api/auth/[...nextauth]/route.js`.
   - Password hash is verified via `bcrypt.compare`.
   - An encrypted HTTP-only JWT cookie containing `user.id` and `user.role` is written to the browser.
   - User is redirected to `/dashboard`.

---

## Workflow 2: Citizen Dashboard Loading

1. **User Action:** Citizen visits `/dashboard`.
2. **Edge Interception:** `middleware.js` decodes the JWT cookie. If `role !== "citizen"`, redirects to `/`.
3. **Server Rendering:** Next.js executes `app/dashboard/page.jsx` as a **React Server Component**.
4. **Database Operations:** Calls `getServerSession(authOptions)` to obtain `session.user.id`, then issues concurrent queries via `Promise.all`:
   - `User.findById(session.user.id)` $\rightarrow$ Retrieves real-time Green Coin balance.
   - `WasteSubmission.countDocuments(...)` $\rightarrow$ Calculates total submissions, approved submissions, and pending reviews.
   - `WasteSubmission.find(...).sort({ createdAt: -1 }).limit(5)` $\rightarrow$ Fetches the 5 most recent waste submissions.
5. **UI Response:** Pre-rendered HTML is streamed to the browser with zero client loading delay.

---

## Workflow 3 & 4: Waste Upload, AI Classification & Green Coin Award

1. **Image Selection:** Citizen navigates to `/dashboard/submit` and picks a file.
2. **Preview & Fingerprint:**
   - File size ($\le 5\text{ MB}$) and MIME type are verified locally.
   - `URL.createObjectURL(file)` generates an immediate visual preview.
   - `getIdempotencyKey(file)` generates a UUID stored in `sessionStorage`.
3. **Submission:** Citizen clicks "Submit Waste".
   - Dispatches a `POST` to `/api/waste-submissions` with binary `FormData` and `Idempotency-Key` header.
4. **Backend Execution:**
   - `getAuthenticatedCitizen()` validates active citizen permissions.
   - Checks MongoDB index `unique_user_waste_submission_idempotency_key` for duplicates.
   - Buffers the file and streams it to Cloudinary folder `greensort/waste-submissions`.
   - Cloudinary returns a secure HTTPS URL and `public_id`.
5. **AI Vision Request:**
   - `classifyWasteImage(imageUrl)` sends the image to OpenRouter with a structured system prompt.
   - The vision LLM returns `{"category": "Plastic", "confidence": 92}`.
6. **Reward Transaction:**
   - Since confidence (92%) $\ge$ threshold (70%), status is set to `approved`.
   - Coin mapping awards 15 coins (`COIN_MAPPING["Plastic"]`).
   - Opens a MongoDB session and begins a replica-set transaction:
     ```javascript
     WasteSubmission.create([{ userId, category: "Plastic", confidence: 92, coinsAwarded: 15, status: "approved" }]);
     User.findOneAndUpdate({ _id: userId }, { $inc: { greenCoins: 15 } });
     Transaction.create([{ userId, type: "award", amount: 15, note: "Waste segregation reward - Plastic" }]);
     ```
   - Transaction commits. Returns HTTP 201 with *"Waste submission created and Green Coins awarded."*
   - If confidence is below 70%, or the category maps to 0 coins (`Non-recyclable`), the route skips the transaction entirely and simply inserts the document with `status: "needs_review"`, returning 201 with *"Waste submission created successfully."*
7. **Client Feedback:** A Sonner toast confirms the submission and the page redirects to `/dashboard`, where the React Server Component re-reads the balance and shows the updated coin total.

---

## Workflow 5: Citizen Transaction History

1. **User Action:** Citizen clicks "Transaction history" from the dashboard (`/dashboard/transactions`).
2. **Server Execution:** `app/dashboard/transactions/page.jsx` (Server Component) queries:
   ```javascript
   Transaction.find({ userId: session.user.id })
     .select("type amount note balanceAfter createdAt")
     .sort({ createdAt: -1 })
     .lean();
   ```
3. **UI Display:** Shows a detailed passbook ledger table displaying dates, descriptions, `+` or `-` amounts in emerald/slate, and historical balance snapshots.

---

## Workflow 6: Business Reward Creation

1. **User Action:** Merchant logs into `/business/dashboard`, selects the "Rewards" tab, and clicks "Create Reward".
2. **Modal Form:** Merchant inputs title ("₹100 Store Voucher"), description, coin cost (300 coins), and stock quantity (25).
3. **API Dispatch:** `POST /api/business/rewards` with JSON payload.
4. **Backend Processing:**
   - `getAuthenticatedBusiness()` resolves the business profile owned by the calling session.
   - Creates a new `Reward` document with `businessId: business._id`, `status: "active"`.
5. **UI Update:** The new reward immediately appears in the merchant's inventory list.

---

## Workflow 7: Citizen Reward Redemption

1. **User Action:** Citizen navigates to `/dashboard/rewards` and clicks "Redeem" on an available reward.
2. **Pre-flight Check:** Client checks if `userCoins >= reward.coinCost` and `reward.quantity > 0`.
3. **API Dispatch:** `POST /api/rewards/redeem` with `{ rewardId }` and unique `Idempotency-Key` header.
4. **Atomic Transaction in MongoDB:**
   - Decrements stock: `Reward.findOneAndUpdate({ _id: rewardId, status: "active", quantity: { $gt: 0 } }, { $inc: { quantity: -1 } })`.
   - Deducts coins: `User.findOneAndUpdate({ _id: citizenId, greenCoins: { $gte: cost } }, { $inc: { greenCoins: -cost } })`.
   - Generates crypto code: `GS-M7X2KL-A4B9`.
   - Creates `Redemption` document with status `"pending"`.
   - Creates `Transaction` document with `type: "redeem"` and negative amount (`-300`).
5. **UI Display:** A modal displays the active voucher code with a copy button.

---

## Workflow 8: Business Voucher Verification at Store

1. **Customer Visit:** Customer presents code `GS-M7X2KL-A4B9` at the merchant's physical checkout counter.
2. **Merchant Entry:** Cashier types or pastes the code into the "Redeem Voucher" input on `/business/dashboard`.
3. **API Dispatch:** `POST /api/business/vouchers/redeem` with `{ redemptionCode: "GS-M7X2KL-A4B9" }`.
4. **Backend Verification:**
   - Verifies store ownership: `String(redemption.businessId) === String(authenticatedBusiness._id)`.
   - Atomic conditional update:
     ```javascript
     Redemption.findOneAndUpdate(
       { _id: existing._id, businessId: business._id, status: "pending" },
       { $set: { status: "redeemed" } }
     );
     ```
5. **Confirmation:** If status was `"pending"`, it transitions to `"redeemed"`. The merchant dashboard displays a green success card showing the customer's name, reward title, coins used, and the redemption date. Scanning the same code again returns HTTP 400 with *"This voucher has already been redeemed (<date>). Duplicate use is prohibited."*, while two simultaneous scans produce one success and one HTTP 409 *"Voucher was already redeemed or is currently being processed by another request."*

---

## Workflow 9: Business Profile Management

1. **User Action:** Merchant switches to the "Profile" tab on `/business/dashboard`.
2. **Update:** Changes store address or phone number and clicks "Save Changes".
3. **API Dispatch:** `PATCH /api/business/profile`.
4. **Security Filter:** The endpoint explicitly whitelists only `businessName`, `email`, `address`, and `description`. Fields like `verified` and `suspended` are ignored, ensuring merchants cannot self-verify.

---

## Workflow 10: Admin Dashboard & Analytics

1. **User Action:** Admin opens `/admin/dashboard` or `/admin/analytics`.
2. **Edge Interception:** `middleware.js` confirms `role === "admin"`.
3. **Overview Metrics:** `/api/admin/dashboard` runs concurrent `countDocuments` queries across users, citizens, businesses, submissions, and redemptions.
4. **Time-Series Aggregation:** On `/admin/analytics`, `/api/admin/analytics?range=30d` runs MongoDB aggregation pipelines:
   - Groups `WasteSubmission` documents by `{ year, month, day }` for daily submission trends.
   - Groups by `category` for pie/doughnut segregation breakdown.
   - Groups `Transaction` where `type === "award"` to chart coin inflation.
5. **Chart.js Rendering:** Renders 5 interactive charts in the browser.

---

## Workflow 11: Admin User Management & Role Changes

1. **User Action:** Admin navigates to `/admin/users` and clicks "Change Role" on a user.
2. **API Dispatch:** `PATCH /api/admin/users/[id]/role` with `{ role: "admin" }` or `{ role: "citizen" }`.
3. **Concurrency-Safe Transaction:**
   - Upserts the `AdminRoleGuard` document (`_id: "admin-role-changes"`, `$setOnInsert: { version: 0 }`) so the lock row exists even on a brand-new database.
   - Inside the transaction, increments that row's `version` to serialize concurrent updates, then re-reads the target user with the session.
   - If demoting an admin, counts total admins: `User.countDocuments({ role: "admin" }).session(session)`. If $\le 1$, aborts with HTTP 400 *"Cannot demote or remove the last remaining administrator."*
   - Updates `user.role`, commits, and returns 200 with the updated user summary.

---

## Workflow 12: Admin Waste Submission Moderation

1. **User Action:** Admin opens `/admin/submissions` and filters by `status: "needs_review"`.
2. **Inspection:** Admin inspects the image URL and model confidence.
3. **Approval:**
   - Admin clicks "Approve".
   - `PATCH /api/admin/submissions/[id]/moderate` with `{ action: "approve" }`.
   - Transaction sets status to `approved`, credits Green Coins to the citizen, and logs the award in `Transaction`.
4. **Rejection:**
   - Admin enters mandatory rejection note (e.g., *"Blurry image / Non-waste item"*) and clicks "Reject".
   - Submission status is set to `rejected` with 0 coins.

---

## Workflow 13: Admin Reward Oversight & Ledger Audit

1. **Reward Oversight (`/admin/rewards`):** Admin can toggle any merchant's reward active/inactive or execute soft delete (`DELETE /api/admin/rewards/[id]`).
2. **Financial Audit (`/admin/redemptions`):**
   - Admin loads `/admin/redemptions`.
   - `/api/admin/redemptions/route.js` queries `Redemption` and matches each record against the `Transaction` ledger using `referenceId`.
   - The `auditRedemption()` helper inspects:
     - Is there exactly 1 matching transaction?
     - Does `transaction.amount === -redemption.coinsUsed`?
     - Does `transaction.userId === redemption.userId`?
     - Is the merchant currently verified?
   - Displays a status tag:
     - <span style="color:green">**Consistent**</span>: Ledger matches perfectly.
     - <span style="color:orange">**Warning**</span>: Historical discrepancy (e.g. merchant suspended later).
     - <span style="color:red">**Inconsistent**</span>: Missing transaction or coin mismatch.
