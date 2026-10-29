# Chapter 01 — Complete Project Structure & File Map

This chapter provides a full architectural inspection of the **GreenSort** codebase. Every file in the repository has been analyzed to identify its purpose, dependencies, and role in the system.

---

## 1. Complete Project Directory Tree

Below is the verified directory structure of the repository (excluding `node_modules`, `.next`, and `.git`):

```text
d:\CODES_D\nextjs-ca2/
├── .env.local.example                 # Template for environment configuration
├── .gitignore                         # Git exclusion rules
├── AGENTS.md                          # Next.js agent instruction block
├── CLAUDE.md                          # Claude development guidelines
├── components.json                    # Shadcn UI configuration file (tsx: false)
├── eslint.config.mjs                  # ESLint flat configuration (ESM)
├── jsconfig.json                      # Path aliases (@/*) for JavaScript language server
├── middleware.js                      # Edge route protection middleware (NextAuth JWT)
├── next-env.d.ts                      # TypeScript declaration auto-maintained by Next.js
├── next.config.js                     # Next.js runtime configuration (Cloudinary remote images)
├── package.json                       # Project metadata, dependencies, and scripts
├── package-lock.json                  # Deterministic dependency lockfile
├── postcss.config.mjs                 # PostCSS configuration for Tailwind CSS v4
├── README.md                          # Project overview documentation
├── tsconfig.json                      # TypeScript compiler configuration (allowJs: true)
├── tsconfig.tsbuildinfo               # Incremental TypeScript compilation cache
│
├── app/                               # Next.js 16 App Router root
│   ├── favicon.ico                    # Website favicon
│   ├── globals.css                    # Tailwind CSS v4 directives and CSS variables
│   ├── layout.jsx                     # Root application layout (Geist font, Sonner Toaster)
│   ├── page.jsx                       # Public marketing landing page (/)
│   │
│   ├── admin/                         # Admin portal routes
│   │   ├── layout.jsx                 # Admin navigation bar and layout shell
│   │   ├── page.jsx                   # Redirects to /admin/dashboard
│   │   ├── analytics/page.jsx         # Time-series analytics with Chart.js
│   │   ├── business/page.jsx          # Merchant partner moderation (verify/suspend)
│   │   ├── dashboard/page.jsx         # High-level overview, counts, and recent feeds
│   │   ├── redemptions/page.jsx       # Financial ledger reconciliation audit table
│   │   ├── rewards/page.jsx           # Global reward catalog oversight and soft delete
│   │   ├── submissions/page.jsx       # Waste submission review and manual moderation
│   │   └── users/page.jsx             # User directory & atomic role promotion/demotion
│   │
│   ├── api/                           # Backend REST API routes
│   │   ├── admin/
│   │   │   ├── analytics/route.js     # GET: Aggregated time-series, categories & coins
│   │   │   ├── business/route.js      # GET: Paginated business partners list
│   │   │   ├── business/[id]/route.js # GET, PATCH: Toggle verified/suspended flags
│   │   │   ├── dashboard/route.js     # GET: Platform summary metrics & recent lists
│   │   │   ├── redemptions/route.js   # GET: Cross-collection audit trail
│   │   │   ├── rewards/route.js       # GET: Searchable rewards listing for admins
│   │   │   ├── rewards/[id]/route.js  # PATCH, DELETE: Status change & soft delete
│   │   │   ├── submissions/route.js   # GET: Filterable submissions feed
│   │   │   ├── submissions/[id]/moderate/route.js # PATCH: Approve/reject submissions
│   │   │   ├── users/route.js         # GET: Paginated user list with role filters
│   │   │   └── users/[id]/role/route.js # PATCH: Concurrency-locked user role update
│   │   │
│   │   ├── auth/
│   │   │   ├── [...nextauth]/route.js # NextAuth handler (Credentials, JWT callbacks)
│   │   │   └── register/route.js      # POST: Public user & business registration
│   │   │
│   │   ├── business/
│   │   │   ├── dashboard/route.js     # GET: Merchant KPIs, active stock, coins claimed
│   │   │   ├── profile/route.js       # GET, PATCH: Business name, address, description
│   │   │   ├── redemptions/route.js   # GET: Redemptions claimed at this business
│   │   │   ├── rewards/route.js       # GET, POST: Rewards management for business
│   │   │   ├── rewards/[id]/route.js  # PATCH, DELETE: Scoped edit & soft-delete
│   │   │   └── vouchers/redeem/route.js # POST: Atomic redemption code verification
│   │   │
│   │   ├── redemptions/route.js       # GET: Citizen's personal voucher list
│   │   ├── rewards/route.js           # GET: Citizen catalog of active verified rewards
│   │   ├── rewards/redeem/route.js    # POST: Atomic transactional coin redemption
│   │   └── waste-submissions/route.js # POST: Upload, AI vision classify, reward coins
│   │
│   ├── auth/                          # Authentication pages
│   │   ├── layout.jsx                 # Centered card layout for login & registration
│   │   ├── login/page.jsx             # Citizen/Business/Admin sign-in form
│   │   └── register/page.jsx          # Public account creation form
│   │
│   ├── business/                      # Business merchant portal
│   │   ├── page.jsx                   # Redirects to /business/dashboard
│   │   └── dashboard/page.jsx         # Merchant SPA: voucher POS card + Rewards/Redemptions/Profile tabs
│   │
│   └── dashboard/                     # Citizen portal
│       ├── page.jsx                   # Citizen dashboard overview (React Server Component)
│       ├── rewards/page.jsx           # Citizen reward catalog & active vouchers modal
│       ├── submit/page.jsx            # Waste upload form with client preview & UUID key
│       └── transactions/page.jsx      # Citizen Green Coin passbook (Server Component)
│
├── components/                        # Reusable React components
│   ├── dashboard-logout.jsx           # Shared NextAuth signOut button
│   └── ui/                            # Shadcn UI design system components
│       ├── button.jsx                 # Base UI Button primitive with CVA variants
│       ├── card.jsx                   # Modular card container, header, and content
│       ├── input.jsx                  # Standard text input with focus ring styles
│       ├── label.jsx                  # Accessible form field label
│       ├── select.jsx                 # Dropdown select menu with popover content
│       └── sonner.jsx                 # Toast notification container (Sonner)
│
├── lib/                               # Core utilities, services & authorization guards
│   ├── adminAuth.js                   # Re-export: getAuthenticatedAdmin from lib/auth.js
│   ├── ai.js                          # OpenRouter multimodal vision classification engine
│   ├── auth.js                        # Shared session + database role guards (all three roles)
│   ├── businessAuth.js                # Re-export: getAuthenticatedBusiness from lib/auth.js
│   ├── citizenAuth.js                 # Re-export: getAuthenticatedCitizen from lib/auth.js
│   ├── cloudinary.js                  # Cloudinary SDK client configuration
│   ├── constants.js                   # Coin mapping & default confidence thresholds
│   ├── db.js                          # Cached Mongoose connection helper (Serverless)
│   ├── normalizeIdentifier.js         # Safe 24-character hex ObjectId normalizer
│   └── utils.js                       # Style concatenation utility (`cn`)
│
├── models/                            # Mongoose database models
│   ├── AdminRoleGuard.js              # Distributed lock collection for admin changes
│   ├── Business.js                    # Merchant profile & verification state
│   ├── Redemption.js                  # Customer voucher records and audit snapshots
│   ├── Reward.d.ts                    # TypeScript types for Reward model
│   ├── Reward.js                      # Partner reward listings and remaining inventory
│   ├── Transaction.js                 # Double-entry style Green Coin ledger
│   ├── User.d.ts                      # TypeScript types for User model
│   ├── User.js                        # User credentials, roles, and balance
│   └── WasteSubmission.js             # Uploaded waste records, AI labels, and statuses
│
├── public/                            # Static web assets
│   ├── file.svg, globe.svg, next.svg, vercel.svg, window.svg
│
├── project-learning-guide/            # This learning guide (12 Markdown chapters)
│   ├── README.md
│   ├── 01-project-structure.md ... 11-viva-preparation-masterclass.md
│
├── scratch/                           # Developer debugging scripts
│   └── inspect-users.js               # Utility script to inspect MongoDB users & businesses
│
├── scripts/                           # Database automation scripts
│   └── seed.js                        # Seeds default admin, business, citizen, and rewards
│
└── types/                             # Global TypeScript declaration augmentations
    └── next-auth.d.ts                 # Augments NextAuth Session and JWT with custom fields
```

---

## 2. File Classification Matrix

To understand which files are actively executed versus auxiliary tooling, we categorize every file:

| Category | Files | Role & Explanation |
| :--- | :--- | :--- |
| **Handwritten Source (Frontend)** | `app/layout.jsx`, `app/dashboard/**/*.jsx`, `app/business/**/*.jsx`, `app/admin/**/*.jsx`, `app/auth/**/*.jsx`, `components/**/*.jsx` | Client and Server components written in clean JavaScript/JSX that power the UI. |
| **Handwritten Source (Backend)** | `app/api/**/*.js`, `lib/*.js` (except legacy), `models/*.js`, `middleware.js` | REST endpoint handlers, authorization guards, Mongoose schemas, and AI integration. |
| **Configuration & Tooling** | `package.json`, `next.config.js`, `postcss.config.mjs`, `eslint.config.mjs`, `components.json`, `jsconfig.json`, `tsconfig.json` | Project setup, CSS bundler rules, linting, and IDE alias resolution. |
| **TypeScript Declarations** | `types/next-auth.d.ts`, `models/User.d.ts`, `models/Reward.d.ts`, `next-env.d.ts` | Type definitions retained to provide IDE IntelliSense for NextAuth session shapes and Mongoose documents without requiring TS compilation. |
| **Database & Utility Scripts** | `scripts/seed.js`, `scratch/inspect-users.js` | Automation scripts executed via CLI to populate initial database records or inspect collection contents. |
| **Removed in this revision** | `lib/categoryMapper.js`, `app/api/transactions/route.js`, `test.txt` | Dead code that was deleted from the working tree. They are documented below so you can explain *why* they are gone if an examiner sees them in older commits. |

---

## 3. Detailed File Analysis

### Root Configuration & Core Files

#### `package.json`
- **Location:** `d:\CODES_D\nextjs-ca2\package.json`
- **Why it exists:** Defines application metadata, runnable scripts (`dev`, `build`, `start`, `lint`), and runtime dependencies.
- **Key Dependencies:** `next` (16.3.8), `react` (19.2.8), `mongoose` (9.10.4), `next-auth` (4.24.15), `cloudinary` (2.11.0), `bcrypt` (6.0.0), `zod` (4.6.5), `chart.js` (4.5.1).
- **Imported By:** NPM / Node.js runtime.

#### `middleware.js`
- **Location:** `d:\CODES_D\nextjs-ca2\middleware.js`
- **Why it exists:** Next.js Edge Middleware that intercepts incoming HTTP requests before they hit pages.
- **Key Responsibilities:**
  1. Allows unrestricted access to `PUBLIC_PATHS` (`/`, `/auth/login`, `/auth/register`, `/api/auth`, `/_next`, etc.).
  2. Extracts and verifies the NextAuth JWT token using `getToken()`.
  3. Enforces role-based route protection: redirects unauthenticated users to `/auth/login`, prevents non-admins from entering `/admin/*`, non-merchants from entering `/business/*`, and non-citizens from entering `/dashboard/*`.
- **Imports:** `next/server`, `next-auth/jwt`.
- **Dependents:** Automatically invoked by Next.js engine on every matched route defined in `config.matcher`.

#### `next.config.js`
- **Location:** `d:\CODES_D\nextjs-ca2\next.config.js`
- **Why it exists:** Configures Next.js image optimization.
- **Key Responsibilities:** Whitelists `res.cloudinary.com` under `images.remotePatterns` so `next/image` can securely render uploaded waste photos without hostname errors.
- **Dependents:** Next.js build and development servers.

#### `jsconfig.json` & `tsconfig.json`
- **Location:** `d:\CODES_D\nextjs-ca2\jsconfig.json`, `tsconfig.json`
- **Why they exist:**
  - `jsconfig.json` configures the JavaScript Language Server to map `@/*` to `./*`, enabling clean absolute imports in `.js` and `.jsx` files.
  - `tsconfig.json` was retained from the TypeScript migration with `"allowJs": true` and `"noEmit": true` so Next.js type-checking tooling and IDEs can read declarations without breaking JS files.

#### `components.json`
- **Location:** `d:\CODES_D\nextjs-ca2\components.json`
- **Why it exists:** Configuration for Shadcn UI CLI.
- **Critical Setting:** `"tsx": false` informs Shadcn to generate components in standard JavaScript (`.jsx`), matching the converted project style.

---

### Library Files (`lib/`)

#### `lib/db.js`
- **Location:** `d:\CODES_D\nextjs-ca2\lib\db.js`
- **Why it exists:** Provides a cached, singleton MongoDB connection using Mongoose.
- **Why it is written this way:** Next.js API routes and Server Components run in a serverless environment where files are re-evaluated frequently. Without global caching (`global._mongoose`), every incoming HTTP request would instantiate a new database connection, rapidly exhausting MongoDB connection limits.
- **Exports:** `dbConnect()` (default export).
- **Imports:** `mongoose`.
- **Imported By:** All API routes, Server Components, and seed scripts.

#### `lib/ai.js`
- **Location:** `d:\CODES_D\nextjs-ca2\lib\ai.js`
- **Why it exists:** The core AI waste classification engine connecting to OpenRouter.
- **Key Responsibilities:**
  1. Configures prioritized free multimodal vision models: `dots-studio/dots-3-note-preview:free`, `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`, and `google/gemma-4-26b-a4b-it:free`.
  2. Implements an active model cooldown map (`modelCooldownMap`) to bypass temporarily rate-limited (429/503) models for 60 seconds.
  3. Sends structured prompts instructing the vision model to return strict JSON (`{"category":"Plastic","confidence":95}`).
  4. Parses responses using bracket-depth counting and sanitizes diagnostic logs to avoid leaking user data or API keys.
- **Exports:** `classifyWasteImage(imageUrl)`, custom error classes `OpenRouterConfigurationError`, `WasteClassificationCapacityError`.
- **Imported By:** `app/api/waste-submissions/route.js`.

#### `lib/cloudinary.js`
- **Location:** `d:\CODES_D\nextjs-ca2\lib\cloudinary.js`
- **Why it exists:** Initializes the Cloudinary SDK v2 with server environment credentials (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`).
- **Exports:** `cloudinary` (default export).
- **Imported By:** `app/api/waste-submissions/route.js`.

#### `lib/constants.js`
- **Location:** `d:\CODES_D\nextjs-ca2\lib\constants.js`
- **Why it exists:** Central source of truth for business reward rules.
- **Key Constants:**
  - `COIN_MAPPING`: Plastic (15), Paper (10), Glass (20), Metal (20), Organic (10), E-waste (30), Non-recyclable (0).
  - `DEFAULT_CONFIDENCE_THRESHOLD`: Defaults to 70% (or `CONFIDENCE_THRESHOLD` env variable).
- **Imported By:** `app/api/waste-submissions/route.js`, `app/api/admin/submissions/[id]/moderate/route.js`.

#### `lib/auth.js`
- **Location:** `d:\CODES_D\nextjs-ca2\lib\auth.js` (added after the earlier audit; currently untracked in Git)
- **Why it exists:** Single implementation of the authoritative database-level role guards used by every API route. It owns one private `getSessionUser()` helper plus three exports: `getAuthenticatedAdmin`, `getAuthenticatedCitizen`, and `getAuthenticatedBusiness`.
- **Key Design Decision:** JWT tokens are stored client-side in cookies and can become stale if an admin demotes a user or suspends a merchant. Each guard calls `getServerSession(authOptions)` and then re-reads the role from MongoDB (`User.findById(...)`, or a `Business` lookup for merchants) before permitting a privileged action.
- **Return contract:** on failure every guard returns `{ errorResponse }` (a ready-made `NextResponse`); on success it returns role-specific fields (`{ user, dbUser }`, `{ user, citizen }`, or `{ user, business }`).
- **Imported By:** `lib/citizenAuth.js`, `lib/businessAuth.js`, `lib/adminAuth.js`, and indirectly every protected route in `app/api/`.

#### `lib/citizenAuth.js`, `lib/businessAuth.js`, `lib/adminAuth.js`
- **Current shape:** one-line re-export modules, e.g. `export { getAuthenticatedCitizen } from "@/lib/auth";`.
- **Why keep them:** API routes import the role-named module (`@/lib/citizenAuth`), so the intent of each import stays obvious while the logic lives in one auditable place. Changing behaviour only needs `lib/auth.js` to be edited.

#### `lib/normalizeIdentifier.js`
- **Location:** `d:\CODES_D\nextjs-ca2\lib\normalizeIdentifier.js`
- **Why it exists:** Normalizes Mongoose ObjectIds, hex strings, or populated documents into a standard lowercase 24-character hexadecimal string, using a `WeakSet` to avoid circular object reference crashes.
- **Imported By:** `app/api/admin/redemptions/route.js`.

#### `lib/utils.js`
- **Location:** `d:\CODES_D\nextjs-ca2\lib\utils.js`
- **Why it exists:** Re-exports the class name merger `cn` from the `cn` package for Tailwind styling in UI components.

---

### Removed Files & Current State

The earlier revision of this guide described `lib/categoryMapper.js`, `test.txt`, and a default-template `app/page.jsx`. Two of those files have since been deleted and the landing page was rewritten, so describe the current state:

1. **`lib/categoryMapper.js` — deleted (was unused):**
   - *What it contained:* A keyword-matching `mapLabelsToCategory(labels)` helper for Google Cloud Vision text labels.
   - *Status:* Removed from the working tree; nothing in `app/`, `lib/`, or `models/` references `categoryMapper` any more.
   - *Explanation for Viva:* It was prototype code superseded by `lib/ai.js`, which sends the image to an OpenRouter multimodal model and receives category + confidence in one step. Deleting it removed a misleading alternative that was never executed.

2. **`app/api/transactions/route.js` — deleted:**
   - *What it contained:* A citizen-only `GET` endpoint returning the Green Coin ledger.
   - *Status:* Removed. No page or component fetches `/api/transactions` any more.
   - *Explanation for Viva:* Transaction history is rendered by the React Server Component `app/dashboard/transactions/page.jsx`, which queries `Transaction` directly on the server. The duplicate API endpoint added a second code path for the same data with no caller.

3. **`test.txt` — deleted:**
   - *Status:* The empty 0-byte scratch file at the project root has been removed.

4. **`app/page.jsx` — rewritten, no longer the Next.js template:**
   - *What it contains now:* A public marketing landing page: sticky header with *Sign In* / *Create Account*, a hero section, four "How GreenSort Works" feature cards, and a footer. It imports only `next/link` and `lucide-react` icons.
   - *Status:* Reachable at `/`. `middleware.js` lists `/` in `PUBLIC_PATHS`, so it renders without a session; the header links route visitors to `/auth/login` and `/auth/register`.

5. **`scratch/inspect-users.js`:**
   - *Status:* A local developer script used to inspect MongoDB user and business records via console logging. Not part of the production runtime.

6. **`lib/utils.js` — present but unused:**
   - *What it contains:* `export { cn } from "cn";` — a one-line re-export of the class-name merger.
   - *Status:* No file imports `@/lib/utils`; every `components/ui/*` primitive imports `cn` straight from the `cn` package. Keep it only as a shadcn-compatible alias, or delete it in a future cleanup.
