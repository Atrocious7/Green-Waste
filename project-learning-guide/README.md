# GreenSort — Complete Project Understanding & Viva Preparation Guide

Welcome to the comprehensive master learning guide for **GreenSort**, an AI-powered smart waste segregation, reward incentive, and merchant voucher platform built with **Next.js (App Router)**, **React**, **MongoDB & Mongoose**, **NextAuth.js**, **Cloudinary**, and **OpenRouter AI Vision**.

This guide is designed to serve as your personal technical companion to understand every line of code, architectural design pattern, database schema, security mechanism, and workflow in the project, so you can present and defend it with 100% confidence during your college viva examination.

---

## Table of Contents

| Chapter | Title | Focus & Key Contents |
| :--- | :--- | :--- |
| **[Chapter 01](./01-project-structure.md)** | **Complete Project Structure & File Map** | Directory tree, classification of handwritten vs generated vs unused files (`categoryMapper.js`, `test.txt`), responsibility matrix. |
| **[Chapter 02](./02-architecture-and-data-flow.md)** | **Application Architecture & Data Lifecycle** | System architecture, React Server Components (RSC) vs Client Components, Mermaid flowcharts for system architecture and submission lifecycles. |
| **[Chapter 03](./03-database-models.md)** | **Database Architecture & Mongoose Schemas** | Detailed field-by-field breakdown of `User`, `Business`, `Reward`, `WasteSubmission`, `Transaction`, `Redemption`, and `AdminRoleGuard`. Indexes, relationships, and schema diagrams. |
| **[Chapter 04](./04-authentication-and-middleware.md)** | **Authentication, Session & Route Protection** | NextAuth JWT authentication flow, `middleware.js` route protection, and database-level role re-verification guards (`citizenAuth`, `businessAuth`, `adminAuth`). |
| **[Chapter 05](./05-api-endpoints-guide.md)** | **Complete API Reference & Implementation** | Comprehensive documentation of all 24 API routes across Citizen, Business, and Admin domains with line-by-line block explanations. |
| **[Chapter 06](./06-frontend-and-components.md)** | **Frontend Pages & Component Deep-Dive** | Analysis of layouts, Citizen Dashboard, Waste Submit, Rewards, Business Dashboard, and Admin sub-portals. React hooks (`useState`, `useEffect`, `useRef`, `useCallback`), Form handling, Chart.js. |
| **[Chapter 07](./07-workflows-step-by-step.md)** | **End-to-End Workflows Step by Step** | Detailed execution traces of 13 critical user journeys from click to database update. |
| **[Chapter 08](./08-ai-and-cloudinary-pipeline.md)** | **AI Vision Classification & Image Upload Pipeline** | Cloudinary buffer upload, OpenRouter multimodal vision prompting, fallback model rotation, cooldown mapping, resilient JSON extraction, and cleanup. |
| **[Chapter 09](./09-security-and-error-handling.md)** | **Security, Concurrency & Data Integrity** | Role-based access control, cryptographic voucher generation, Mongo replica-set transactions, atomic conditional queries, optimistic concurrency locking, and diagnostic redactions. |
| **[Chapter 10](./10-typescript-to-javascript-migration.md)** | **TypeScript-to-JavaScript Architecture** | Why the project uses JavaScript/JSX, purpose of `jsconfig.json`, `tsconfig.json`, `components.json` (`"tsx": false`), and remaining `.d.ts` declarations. |
| **[Chapter 11](./11-viva-preparation-masterclass.md)** | **Viva Preparation, Demonstration Script & Q&A** | 2-minute pitch, 5-minute deep explanation, step-by-step viva demo script, traps to avoid, and 30+ Basic, Intermediate, and Advanced viva questions with answers. |

---

## Quick Technology Reference

- **Framework**: Next.js 16 (App Router)
- **UI & Styling**: React 19, Tailwind CSS v4, Lucide React, Shadcn UI / Base UI, Sonner Toaster
- **Data Visualization**: Chart.js & React-Chartjs-2 (dynamically loaded on client)
- **Database & ODM**: MongoDB with Mongoose 9 (utilizing transactions and compound partial indexes)
- **Authentication**: NextAuth.js v4 (JWT strategy with authoritative database verification)
- **Image Storage**: Cloudinary (Buffer stream uploads with rollback on error)
- **AI Classification**: OpenRouter API (`dots-studio`, `nvidia/nemotron`, `google/gemma` free vision endpoints)
- **Language**: Modern JavaScript (ES Modules, Async/Await) with JSDoc typing and selective TypeScript declarations.
