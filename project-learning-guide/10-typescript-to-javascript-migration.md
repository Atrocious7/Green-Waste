# Chapter 10 — TypeScript-to-JavaScript Architecture & Migration

This chapter explains why **GreenSort** was converted to modern JavaScript/JSX, the architectural role of retained TypeScript declarations (`.d.ts`), and how IDE type-safety is preserved without compilation overhead.

---

## 1. Migration Overview & Rationale

During earlier iterations, the project utilized TypeScript (`.ts` and `.tsx`). It was subsequently simplified and converted to standard **JavaScript (ES Modules)** and **JSX** (`.js`, `.jsx`).

### Why JavaScript was Chosen:
1. **Simplified Developer Experience:** Eliminates TypeScript compilation errors, build-time type mismatches, and complex generic type definitions.
2. **Direct Execution:** Code executed in development runs directly through Node.js and Next.js SWC bundler without intermediary type-checking delays.
3. **High Readability for Educational Evaluation:** JavaScript code is cleaner and more accessible for college evaluators and viva demonstrations.

---

## 2. Why TypeScript Tooling & Declarations Are Still Present

Students often ask during their viva:
> *"If this is a JavaScript project, why are there `tsconfig.json` and `.d.ts` files in the repository?"*

Here is the exact technical explanation to present:

### A. Next.js Framework Expectations (`next-env.d.ts` & `tsconfig.json`)
- Next.js detects whether `@types/node` or `@types/react` are in `devDependencies`. If present, `next dev` automatically generates and maintains `next-env.d.ts` and `tsconfig.json`.
- The **actual** `tsconfig.json` in the repository contains:
  ```json
  {
    "compilerOptions": {
      "target": "ES2017",
      "lib": ["dom", "dom.iterable", "esnext"],
      "allowJs": true,           // JS files can be resolved by the compiler
      "skipLibCheck": true,      // Do not type-check node_modules
      "strict": true,
      "noEmit": true,            // Never emit .js output
      "esModuleInterop": true,
      "module": "esnext",
      "moduleResolution": "bundler",
      "resolveJsonModule": true,
      "isolatedModules": true,
      "jsx": "react-jsx",
      "incremental": true,
      "plugins": [{ "name": "next" }],
      "paths": { "@/*": ["./*"] }
    },
    "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts", "**/*.mts"],
    "exclude": ["node_modules"]
  }
  ```
- Two details worth knowing: `include` lists only TypeScript files, so `.js`/`.jsx` sources are **not** part of the type-check sweep (they are still imported and resolved thanks to `allowJs`), and `"incremental": true` is what produces the `tsconfig.tsbuildinfo` cache file at the project root.
- Removing `tsconfig.json` would cause Next.js to regenerate it on the next `npm run dev`.

---

### B. Ambient Module Augmentation (`types/next-auth.d.ts`)
NextAuth.js v4 defines standard session shapes out of the box with only `name`, `email`, and `image`. In GreenSort, sessions also carry `role` and `businessId`.

To inform the IDE and Next.js of these custom fields, `types/next-auth.d.ts` uses TypeScript **declaration merging**:
```typescript
// types/next-auth.d.ts
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role?: string;
      businessId?: string | null;
    };
  }

  interface User {
    id: string;
    role?: string;
    businessId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
      role?: string;
      businessId?: string | null;
    };
  }
}
```
- **Why this is beneficial in JavaScript:** Even though source files are `.js`, modern IDEs (like VS Code) read `.d.ts` declaration files in the background to provide instant autocompletion when typing `session.user.role`.

---

### C. Mongoose Document Declarations (`models/User.d.ts`, `models/Reward.d.ts`)
These declaration files declare the shape of Mongoose documents: `IUser` (with `role: "citizen" | "business" | "admin"`, `greenCoins: number`, optional `business: Types.ObjectId`) and `IReward` (`status: "active" | "inactive" | "deleted"`), each exported as a `Model<T>` default. They are documentation/IntelliSense only — the models are actually *defined* in `models/User.js` and `models/Reward.js`, and only those two models have declarations.

---

### D. The Role of `jsconfig.json`
`jsconfig.json` tells the JavaScript language service how to resolve root-relative imports:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```
This enables imports like `import dbConnect from "@/lib/db"` to resolve instantly without using brittle relative paths like `../../lib/db`.

---

### E. Shadcn UI Configuration (`components.json`)
In `components.json`:
```json
{
  "style": "base-nova",
  "rsc": true,
  "tsx": false,
  "tailwind": { "css": "app/globals.css", "baseColor": "neutral", "cssVariables": true },
  "iconLibrary": "lucide",
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui", "lib": "@/lib", "hooks": "@/hooks" }
}
```
Setting `"tsx": false` is the official configuration instructing Shadcn to output components in standard JavaScript/JSX when generating UI elements. One caveat: the generated primitives currently import `cn` from the `cn` npm package rather than the configured `@/lib/utils` alias, which is why `lib/utils.js` exists but is unused.

---

## 3. JSDoc Type Annotations in Source Code

To maintain type clarity without TypeScript syntax, handwritten `.js` and `.jsx` files utilize **JSDoc comments**:

```javascript
/** @type {Record<string, string>} */
const roleRedirectMap = {
  citizen: "/dashboard",
  business: "/business/dashboard",
  admin: "/admin/dashboard",
};

/** @param {{ email: string; password: string }} values */
const onSubmit = async (values) => { ... }
```

This represents the industry-standard pattern used by major open-source projects (such as Svelte and Webpack) to achieve full type-safety without build-step overhead.
