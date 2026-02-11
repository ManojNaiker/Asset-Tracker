# AssetAlloc - Asset Inventory & Allocation System

## Overview

AssetAlloc is a web-based asset inventory and allocation management system built for Light Microfinance Pvt Ltd. It handles the full asset lifecycle — from creating asset types and tracking inventory, to allocating assets to employees, handling returns/replacements, and verifying assets through a dedicated verifier workflow.

Key capabilities:
- Employee master management with bulk import/export
- Dynamic asset type definitions with configurable field schemas (stored as JSONB)
- Asset allocation, return, reallocation, and replacement workflows
- Verifier module for asset verification with image uploads
- Admin dashboard with real-time statistics and charts (Recharts)
- Complete audit trail logging
- Role-based access control (Admin, Verifier, Employee)
- Light and dark mode theming

Default admin credentials: `admin@lightmf.com` / `Admin@123`

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Monorepo Structure
The project uses a single-repo layout with three top-level directories:
- `client/` — React frontend (SPA)
- `server/` — Express.js backend (API server)
- `shared/` — Shared types, schemas, and route definitions used by both client and server

### Frontend (`client/src/`)
- **Framework**: React with TypeScript, bundled by Vite
- **Routing**: `wouter` for client-side routing (lightweight alternative to React Router)
- **State/Data**: TanStack React Query for server state management; no Redux or global client state
- **UI Components**: shadcn/ui component library (New York style) built on Radix UI primitives with Tailwind CSS
- **Forms**: `react-hook-form` with `zod` validation via `@hookform/resolvers`
- **Charts**: Recharts for dashboard visualizations
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support). Custom fonts: Inter (sans) and Poppins (display)
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

Pages are organized in `client/src/pages/` with a `LayoutShell` component providing consistent sidebar navigation. Role-based navigation filtering happens in the layout shell. Custom hooks in `client/src/hooks/` encapsulate data fetching logic for each domain (employees, assets, allocations, etc.).

### Backend (`server/`)
- **Framework**: Express.js with TypeScript, run via `tsx` in development
- **Authentication**: Passport.js with `passport-local` strategy, session-based auth stored in PostgreSQL via `connect-pg-simple`
- **Password Security**: `bcryptjs` for password hashing
- **File Uploads**: `multer` with disk storage to `client/public/uploads/`
- **API Design**: RESTful JSON APIs under `/api/` prefix. Route definitions (paths, methods, input/output schemas) are shared between client and server via `shared/routes.ts`
- **Build**: esbuild bundles server code to `dist/index.cjs` for production; Vite builds client to `dist/public/`
- **Dev server**: Vite dev server is integrated as middleware in development mode, with HMR support

### Database
- **Engine**: PostgreSQL (required, via `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-validation integration
- **Schema location**: `shared/schema.ts` — defines all tables including users, employees, assetTypes, assets, allocations, verifications, and auditLogs
- **Schema push**: Use `npm run db:push` (drizzle-kit push) to sync schema to the database
- **Key design decisions**:
  - Asset types use a JSONB `schema` column for dynamic field definitions, allowing admins to create custom fields per asset type without schema migrations
  - Enums are defined as TypeScript const arrays: `userRoles`, `assetStatuses`, `allocationStatuses`, `verificationStatuses`
  - Session store uses `connect-pg-simple` backed by the same PostgreSQL database

### Shared Code (`shared/`)
- `schema.ts` — Drizzle table definitions, insert schemas (via `drizzle-zod`), TypeScript types, and enum constants
- `routes.ts` — API route contract definitions with Zod schemas for inputs and outputs, used by both frontend hooks and backend handlers to ensure type safety

### Authentication & Authorization
- Session-based authentication using Passport.js local strategy
- Sessions stored in PostgreSQL via `connect-pg-simple`
- Three roles: `admin` (full access), `verifier` (verification and image upload), `employee` (view-only for own assets)
- Account locking after failed login attempts
- Forced password change on first admin login
- Role-based page access enforced in frontend routing and backend API checks

### Key Scripts
- `npm run dev` — Start development server (tsx + Vite HMR)
- `npm run build` — Build for production (Vite for client, esbuild for server)
- `npm run start` — Run production build
- `npm run db:push` — Push Drizzle schema to PostgreSQL
- `npm run check` — TypeScript type checking

## External Dependencies

### Database
- **PostgreSQL** — Primary data store. Connection via `DATABASE_URL` environment variable. Used for application data and session storage.

### Key NPM Packages
- **drizzle-orm** + **drizzle-kit** — ORM and migration tooling for PostgreSQL
- **express** — HTTP server framework
- **passport** + **passport-local** — Authentication
- **connect-pg-simple** — PostgreSQL session store for Express sessions
- **bcryptjs** — Password hashing
- **multer** — File upload handling
- **zod** + **drizzle-zod** — Schema validation shared between client and server
- **@tanstack/react-query** — Server state management on the frontend
- **recharts** — Dashboard charts
- **wouter** — Client-side routing
- **react-hook-form** — Form management
- **shadcn/ui** (Radix UI primitives) — UI component library
- **tailwindcss** — Utility-first CSS framework
- **xlsx** — Excel import/export
- **date-fns** — Date formatting utilities
- **lucide-react** — Icon library

### File Storage
- Local disk storage via multer to `client/public/uploads/` directory. No cloud storage integration currently — designed to be swappable for cloud deployment.

### Email/Notifications
- **nodemailer** is listed as a dependency (email-ready architecture for allocation acknowledgements, verification notifications), but full email integration may need SMTP configuration via environment variables.