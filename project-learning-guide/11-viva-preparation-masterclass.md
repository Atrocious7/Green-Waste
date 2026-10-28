# Chapter 11 — Viva Preparation Masterclass & Demonstration Guide

This chapter is your complete study and defense blueprint for presenting **GreenSort** to your college professor, external examiner, or project evaluation committee.

---

## 1. High-Impact Project Presentations

### The 2-Minute Project Pitch
> *"Good morning, Professors. GreenSort is an intelligent circular-economy web platform designed to solve urban household waste segregation challenges. While municipal corporations provide separate bins for wet, dry, and recyclable waste, citizen participation remains low due to a lack of immediate feedback and incentives.*
>
> *GreenSort solves this through a three-party digital ecosystem built on Next.js 16, React 19, MongoDB, and Cloudinary. When a citizen takes a photo of segregated waste, our backend streams the image to an AI multimodal vision model via OpenRouter. The AI classifies the waste into categories like Plastic, Metal, Paper, or E-waste with a confidence score. If confidence exceeds 70%, the citizen instantly earns Green Coins awarded via an atomic database transaction.*
>
> *Citizens can spend their Green Coins on a decentralized reward catalog containing discount vouchers funded by local businesses. At the physical merchant checkout, store cashiers enter the customer's unique voucher code on their dedicated portal, which atomically redeems the voucher and prevents double usage. Finally, an administrative dashboard provides real-time time-series analytics, waste moderation controls, and a double-entry ledger audit table to ensure financial integrity.*
>
> *The entire codebase is written in clean, modern JavaScript with Next.js App Router, combining the speed of React Server Components with resilient distributed database patterns."*

---

### The 5-Minute Technical Walkthrough
1. **Frontend Architecture:** *"We adopted the Next.js App Router. Pages like `/dashboard` and `/dashboard/transactions` are React Server Components that fetch directly from MongoDB on the server, resulting in zero client-side bundle overhead and no loading spinners. Highly interactive views, such as `/dashboard/submit` and `/business/dashboard`, are Client Components that manage file previews, clipboard interactions, and reactive state."*
2. **AI & Cloudinary Integration:** *"When an image is submitted, the server converts the upload into a memory stream buffer and pipes it to Cloudinary. The secure URL is then dispatched to OpenRouter, querying free vision models like `dots-studio`, `nemotron`, or `gemma`. We engineered an in-memory model cooldown map that automatically routes around temporarily rate-limited models, paired with a bracket-depth JSON parser that extracts clean outputs even if the model produces markdown formatting."*
3. **Data Integrity & Concurrency:** *"Rather than relying on basic CRUD updates, we implemented MongoDB replica-set transactions. When a citizen redeems a voucher, decrementing store inventory, deducting citizen coins, generating a cryptographically secure voucher code, and writing the transaction audit entry all happen inside a single atomic transaction. Furthermore, client-side UUID idempotency keys backed by partial compound unique indexes guarantee that accidental double-clicks can never award duplicate coins or double-charge a user."*
4. **Security & Authentication:** *"We use NextAuth.js with an encrypted JWT strategy. Edge routing is protected by `middleware.js`. Crucially, to prevent stale-token privilege escalation, our backend API routes call authoritative database guards (`citizenAuth`, `businessAuth`, `adminAuth`) that re-verify the user's real-time permissions directly against MongoDB."*

---

## 2. Step-by-Step Viva Demonstration Script

Follow these steps to conduct a smooth, error-free live demonstration:

### Step 1: Pre-Demo Preparation
- Ensure MongoDB is running and environment variables are configured in `.env.local`.
- Run the seed script once if starting fresh: `node scripts/seed.js`.
  - Default Admin: `admin@greensort.local` / `password123`
  - Default Merchant: `cafe@greenbeans.local` / `password123`
  - Default Citizen: `user@citizen.local` / `password123` (starts with 1,200 coins)
- Start the server: `npm run dev` and open `http://localhost:3000/auth/login`.

### Step 2: Citizen Flow (Waste Upload & AI Reward)
1. Log in as `user@citizen.local`.
2. Point out the dashboard stats: 1,200 Green Coins, zero/low waste count. Explain that this is a **React Server Component** reading MongoDB directly.
3. Click **"Submit Waste"** (`/dashboard/submit`).
4. Select a clear picture of a plastic bottle or aluminum can.
5. Point out the instant client preview generated via `URL.createObjectURL()`.
6. Click **"Submit Waste"**. Explain that:
   - Client sends an `Idempotency-Key` UUID.
   - Server streams the image to Cloudinary.
   - OpenRouter AI analyzes the photo and returns category and confidence.
   - An atomic transaction awards coins (e.g. +15 coins for Plastic).
7. Demonstrate that the citizen's balance has updated to **1,215 Green Coins**.
8. Click **"Transaction history"** to show the newly added ledger record with `balanceAfter: 1215`.

### Step 3: Citizen Flow (Redeeming a Voucher)
1. Click **"Rewards & Vouchers"** (`/dashboard/rewards`).
2. Point out that the list shows rewards published by verified businesses.
3. Click **"Redeem"** on a ₹50 Café Discount (cost: 200 coins).
4. Show the instant modal containing the generated voucher code: `GS-XXXXXX-XXXX`.
5. Click **"Copy Code"** to demonstrate clipboard integration.
6. Switch to the **"My Vouchers"** tab to show the status is `"pending"`.

### Step 4: Merchant Flow (Point-of-Sale Verification)
1. Open an Incognito window and navigate to `http://localhost:3000/auth/login`.
2. Sign in as `cafe@greenbeans.local`.
3. The merchant lands on `/business/dashboard`.
4. Paste the copied voucher code into the **"Redeem Voucher"** input box and click **"Validate & Redeem"**.
5. Show the green confirmation banner displaying the customer's name and reward details.
6. Try clicking "Validate & Redeem" a second time with the same code: show the error *"This voucher has already been redeemed"*. Explain the atomic status guard to the teacher.

### Step 5: Admin Flow (Analytics & Audit)
1. In another tab, sign in as `admin@greensort.local`.
2. Show the **Admin Dashboard** (`/admin/dashboard`) displaying total users, platform submissions, and coin circulation.
3. Open **"Analytics"** (`/admin/analytics`) to demonstrate the interactive Chart.js line and doughnut charts.
4. Open **"Redemption Audit"** (`/admin/redemptions`) to showcase the cross-collection financial audit table with the green **"Consistent"** status indicator.

---

## 3. Top Viva Questions & Answers

### Level 1: Basic (Core Concepts & Stack)

#### Q1: What is the main objective of the GreenSort project?
> **Answer:** GreenSort is a smart waste management platform that uses AI image recognition to incentivize household waste segregation. Citizens upload photos of separated waste, earn Green Coins based on AI classification, and spend those coins on retail vouchers provided by local merchant partners.

#### Q2: What technology stack does GreenSort use?
> **Answer:**
> - **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide icons, Shadcn UI / Base UI.
> - **Backend:** Next.js API Route Handlers (Node.js ES Modules).
> - **Database:** MongoDB with Mongoose 9.
> - **Authentication:** NextAuth.js v4 (JWT strategy).
> - **External Services:** Cloudinary (media CDN) and OpenRouter (multimodal vision AI).

#### Q3: What user roles exist in the system and how are they separated?
> **Answer:** There are three roles: `citizen`, `business`, and `admin`. Separation is enforced at the network boundary using Next.js `middleware.js` and verified at the database level inside API handlers using helpers like `getAuthenticatedCitizen()` and `getAuthenticatedAdmin()`.

#### Q4: Why did you choose MongoDB instead of a relational database like MySQL?
> **Answer:** MongoDB's flexible document model easily stores nested structures such as AI predicted labels (`predictedLabels: [{ label, score }]`), geo-coordinates, and audit snapshots. Furthermore, with MongoDB replica sets, we achieve ACID transactions across multiple collections while retaining high write speeds for image submission feeds.

---

### Level 2: Intermediate (APIs, Next.js & React)

#### Q5: What is the difference between React Server Components (RSC) and Client Components in your project?
> **Answer:**
> - **RSC (`app/dashboard/page.jsx`):** Executes exclusively on the server. It imports Mongoose models and queries MongoDB directly without an HTTP fetch call. It ships zero JavaScript bundle to the browser.
> - **Client Components (`"use client"`):** Executes on the browser after hydration. Used for interactive forms (`app/dashboard/submit/page.jsx`), tabs, clipboard copying, and dynamic charts (`app/admin/analytics/page.jsx`).

#### Q6: Why did you convert the project from TypeScript to JavaScript?
> **Answer:** The project was converted to JavaScript/JSX to simplify execution, eliminate build-time compilation overhead, and make the codebase easily readable for academic inspection. Type-safety is preserved using JSDoc annotations and ambient TypeScript declarations (`types/next-auth.d.ts`).

#### Q7: How does the AI classification pipeline work?
> **Answer:**
> 1. Citizen uploads an image.
> 2. The server streams the file buffer to Cloudinary (`uploadImage()`).
> 3. Cloudinary's secure URL is passed to `classifyWasteImage()` in `lib/ai.js`.
> 4. `lib/ai.js` queries OpenRouter using multimodal vision models (`dots-studio`, `nemotron`, `gemma`).
> 5. A bracket-depth counter extracts the category and confidence percentage.
> 6. If confidence is $\ge 70\%$, Green Coins are awarded automatically. If below 70%, it is queued for admin moderation.

#### Q8: How does Cloudinary rollback work if AI classification fails?
> **Answer:** In `app/api/waste-submissions/route.js`, the AI request is wrapped in a `try...catch` block. If OpenRouter returns an error or capacity timeout, the catch block immediately calls `deleteUploadedImage(uploadedImage.public_id)` before returning HTTP 502/503. This prevents orphaned images from wasting Cloudinary storage.

---

### Level 3: Advanced (Security, Transactions & Architecture)

#### Q9: What happens if a user submits a waste photo multiple times simultaneously?
> **Answer:** GreenSort implements client-server idempotency. The browser generates a UUID stored in `sessionStorage` and sends it as an `Idempotency-Key` header. MongoDB enforces a compound partial unique index on `{ userId: 1, idempotencyKey: 1 }`. If a duplicate request arrives, MongoDB throws error code `11000`. The server intercepts this, fetches the existing submission, and returns HTTP 200 without charging or awarding extra coins.

#### Q10: How do you prevent race conditions when a user redeems a voucher with low coins?
> **Answer:** In `app/api/rewards/redeem/route.js`, we use an atomic guarded update:
> ```javascript
> User.findOneAndUpdate(
>   { _id: citizenId, greenCoins: { $gte: reward.coinCost } },
>   { $inc: { greenCoins: -reward.coinCost } },
>   { session: sessionDb }
> );
> ```
> This is executed inside a MongoDB session transaction. If two requests execute at the exact same millisecond, MongoDB's document write lock ensures only the first request sees `greenCoins >= cost`. The second request finds zero matching documents and throws an "Insufficient Green Coins" error.

#### Q11: What is the purpose of `AdminRoleGuard`?
> **Answer:** In `app/api/admin/users/[id]/role/route.js`, changing an admin's role writes to a single shared document `AdminRoleGuard.findOneAndUpdate({ _id: "admin-role-changes" }, { $inc: { version: 1 } })`. This serializes concurrent role modifications. Inside the transaction, it checks `User.countDocuments({ role: "admin" })`. If $\le 1$, the operation aborts, ensuring the system can never accidentally demote its last remaining administrator.

#### Q12: How does the admin redemption audit work?
> **Answer:** Located at `app/api/admin/redemptions/route.js`, the endpoint loads all `Redemption` documents and cross-references them against `Transaction` ledger records using `referenceId`. The `auditRedemption()` helper verifies:
> 1. That a corresponding transaction exists with `amount === -redemption.coinsUsed`.
> 2. That the user ID matches between both records.
> 3. That `balanceAfter` is a valid positive number.
> It flags any discrepancies as `inconsistent` or `warning`, providing complete ledger auditability.

---

## 4. Common Mistakes & Traps to Avoid During Your Viva

1. **Do NOT claim that `app/page.jsx` is your main landing page:**
   - *Truth:* `app/page.jsx` is the default Next.js template. Explain that the application's actual user flows begin at `/auth/login`, `/dashboard`, `/business/dashboard`, and `/admin/dashboard`.
2. **Do NOT claim that `lib/categoryMapper.js` is active code:**
   - *Truth:* `categoryMapper.js` was a prototype keyword-matching helper. The real application uses multimodal vision AI via `lib/ai.js`.
3. **Do NOT claim that Google Vision API is currently being called:**
   - *Truth:* Although `.env.local.example` mentions `GOOGLE_VISION_API_KEY` from early prototypes, the active production code in `lib/ai.js` connects to **OpenRouter** (`https://openrouter.ai/api/v1/chat/completions`).
4. **Do NOT claim that transactions work on standalone MongoDB:**
   - *Truth:* Multi-document transactions require a replica set (`--replSet`). Explain that your code handles this gracefully: `isTransactionUnsupportedError` returns HTTP 503 if transactions are not supported on the host.
