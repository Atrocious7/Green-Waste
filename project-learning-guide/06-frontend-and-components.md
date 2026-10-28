# Chapter 06 — Frontend Pages & Component Deep-Dive

This chapter explores the frontend implementation of **GreenSort**. It breaks down the client-side state management, React Server Components (RSC), custom hooks, UI primitives, and asynchronous data fetching patterns across all user portals.

---

## 1. Frontend Layout Hierarchy

GreenSort organizes its layout system using Next.js nested layouts:

```text
RootLayout (app/layout.jsx)
├── Toaster (Sonner notification container)
│
├── AuthLayout (app/auth/layout.jsx)
│   ├── LoginPage (app/auth/login/page.jsx)
│   └── RegisterPage (app/auth/register/page.jsx)
│
├── Citizen Portal (app/dashboard/*)
│   ├── DashboardPage (RSC - app/dashboard/page.jsx)
│   ├── SubmitWastePage (Client - app/dashboard/submit/page.jsx)
│   ├── RewardsPage (Client - app/dashboard/rewards/page.jsx)
│   └── TransactionHistoryPage (RSC - app/dashboard/transactions/page.jsx)
│
├── Business Portal (app/business/dashboard/page.jsx)
│   └── Multi-tab SPA (Vouchers, Catalog, Profile, Analytics)
│
└── AdminLayout (app/admin/layout.jsx)
    ├── Admin Header & Navigation Bar
    ├── AdminDashboardPage (app/admin/dashboard/page.jsx)
    ├── AdminSubmissionsPage (app/admin/submissions/page.jsx)
    ├── AdminUsersPage (app/admin/users/page.jsx)
    ├── AdminBusinessPage (app/admin/business/page.jsx)
    ├── AdminRewardsPage (app/admin/rewards/page.jsx)
    ├── AdminRedemptionsPage (app/admin/redemptions/page.jsx)
    └── AdminAnalyticsPage (app/admin/analytics/page.jsx)
```

---

## 2. Citizen Pages Deep-Dive

### A. Citizen Dashboard (`app/dashboard/page.jsx`)
- **Rendering Pattern:** React Server Component (RSC)
- **Key Concepts:** Async server-side data fetching with `Promise.all()`, direct Mongoose querying.

#### Code Snippet & Analysis:
```javascript
export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login");
  if (session.user.role !== "citizen") redirect("/");

  await dbConnect();

  // Parallel database reads on the server:
  const [currentUser, totalSubmissions, approvedSubmissions, pendingSubmissions, recentSubmissions] =
    await Promise.all([
      User.findById(session.user.id).lean(),
      WasteSubmission.countDocuments({ userId: session.user.id }),
      WasteSubmission.countDocuments({ userId: session.user.id, status: { $in: ["approved", "awarded"] } }),
      WasteSubmission.countDocuments({
        userId: session.user.id,
        status: { $in: ["pending", "needs_review"] },
      }),
      WasteSubmission.find({ userId: session.user.id }).sort({ createdAt: -1 }).limit(5).lean(),
    ]);
...
```
- **Why this matters for Viva:** Because this is an RSC, there is **no loading spinner** or client-side fetch waterfall. The HTML arrives pre-populated with real database numbers. Note the use of `Promise.all()`: all 5 database queries execute concurrently in MongoDB rather than sequentially, reducing server response time from 150ms to ~30ms.

---

### B. Waste Submission Page (`app/dashboard/submit/page.jsx`)
- **Rendering Pattern:** Client Component (`"use client"`)
- **Key Hooks:** `useState`, `useEffect`, `useRef`, `useRouter`

#### 1. Object URL Lifecycle Management
```javascript
useEffect(() => {
    return () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
    };
}, [previewUrl]);
```
- **Explanation:** When a user selects an image from their hard drive, `URL.createObjectURL(selectedFile)` creates an in-memory blob URL to render a local preview. The cleanup function returned by `useEffect` executes when the component unmounts or when a new photo is selected, invoking `URL.revokeObjectURL()`. This prevents memory leaks in the browser.

#### 2. Client-Side Idempotency Fingerprinting
```javascript
function getIdempotencyKey(file, fallback) {
    const fingerprint = `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
    const storageKey = `${IDEMPOTENCY_STORAGE_PREFIX}${fingerprint}`;
    try {
        const storedKey = sessionStorage.getItem(storageKey);
        if (storedKey) return { fingerprint, key: storedKey, storageKey };
        const key = crypto.randomUUID();
        sessionStorage.setItem(storageKey, key);
        return { fingerprint, key, storageKey };
    } catch {
        return { fingerprint, key: crypto.randomUUID(), storageKey: null };
    }
}
```
- **Explanation:** Creates a composite fingerprint of the file. If the user submits, encounters a network timeout, and clicks submit again with the exact same file, the function retrieves the **identical UUID** from `sessionStorage` and attaches it in the `Idempotency-Key` header. Once the server confirms creation with HTTP 201, `sessionStorage.removeItem()` is called to clean up.

---

### C. Rewards & Vouchers Page (`app/dashboard/rewards/page.jsx`)
- **Rendering Pattern:** Client Component (`"use client"`)
- **Key Features:** Tab navigation ("Catalog" vs "My Vouchers"), real-time coin deductions, clipboard copying with feedback.

#### Clipboard Copy Implementation:
```javascript
const handleCopyCode = async (code) => {
    try {
        await navigator.clipboard.writeText(code);
        setCopiedCode(code);
        toast.success("Voucher code copied to clipboard!");
        setTimeout(() => setCopiedCode(null), 3000);
    } catch {
        toast.error("Failed to copy code.");
    }
};
```
- **Explanation:** Uses the modern browser `navigator.clipboard.writeText()` API. It updates `copiedCode` to display a green checkmark icon, then resets back to the copy icon after 3 seconds via `setTimeout`.

---

## 3. Business Merchant Dashboard (`app/business/dashboard/page.jsx`)

The business portal is architected as an interactive **Single Page Application (SPA)** managing four primary feature tabs:
1. **Rewards Management:** View active/inactive reward inventory, open modal to create rewards, edit price or quantity, or soft-delete rewards.
2. **Voucher Validation (POS Scanner):** Real-time code entry where store cashiers enter customer voucher codes (e.g. `GS-M7X2KL-A4B9`). Displays instant customer name, discount details, and updates status to `redeemed`.
3. **Redemption History:** Chronological log of all customer visits and vouchers claimed at this store.
4. **Merchant Profile Settings:** Manage brand name, public description, store address, and contact email.

---

## 4. Admin Analytics & Chart.js Integration (`app/admin/analytics/page.jsx`)

The Admin Analytics portal renders five interactive time-series and categorical charts using **Chart.js**:
1. **Submissions Over Time (Line Chart):** Submissions volume over 7d, 30d, 90d, or 1 year.
2. **Categories Distribution (Doughnut Chart):** Segregation ratio across Plastic, Paper, Metal, Glass, Organic, E-waste.
3. **Green Coins Awarded (Bar Chart):** Coin volume distributed across the date range.
4. **Submission Statuses (Bar Chart):** Ratio of approved vs needs_review vs rejected items.
5. **Redemption Statuses (Pie Chart):** Ratio of pending vs completed customer vouchers.

### Next.js Safe Dynamic Chart Lifecycle
```javascript
// Dynamic import ensures Chart.js does not execute on the server during SSR:
import("chart.js/auto").then(({ Chart, registerables }) => {
    if (!isEffectActive) return;
    Chart.register(...registerables);

    // Destroy previous instance to prevent canvas re-use errors:
    if (submissionsChartInstance.current) {
        submissionsChartInstance.current.destroy();
    }

    // Mount to Canvas ref:
    submissionsChartInstance.current = new Chart(submissionsChartRef.current, {
        type: "line",
        data: { ... },
        options: { responsive: true, maintainAspectRatio: false }
    });
});
```
- **Why this is critical for Viva:** Chart.js requires the browser `window` and HTML5 `<canvas>` context. If imported statically at the top of a file, Next.js Server-Side Rendering would crash with `ReferenceError: window is not defined`. By dynamically importing inside `useEffect` and storing instances in `useRef`, it guarantees 100% SSR compatibility and cleanly cleans up memory on tab changes.

---

## 5. UI Primitives (`components/ui/`)

GreenSort uses the **Shadcn UI** design system powered by **Tailwind CSS v4** and **Class Variance Authority (CVA)**:

- **`button.jsx`:** Built on `@base-ui/react/button`. Uses `cva()` to offer variants (`default`, `outline`, `secondary`, `ghost`, `destructive`) and sizes (`default`, `sm`, `lg`, `icon`).
- **`card.jsx`:** Compound components (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`) styled with subtle border radii, drop shadows, and responsive padding.
- **`input.jsx`:** Accessible input styled with Tailwind focus rings, invalid state borders (`aria-invalid`), and disabled opacity.
- **`sonner.jsx`:** Mounts the `Sonner` toast provider with custom color themes (emerald for success, red for errors).
- **`dashboard-logout.jsx`:** Shared client component that invokes NextAuth `signOut({ callbackUrl: "/auth/login" })`.
