# AssetAlloc - Asset Inventory & Allocation System

## Overview

AssetAlloc is a web-based Asset Inventory & Asset Allocation application built for Light Microfinance Pvt Ltd. It provides complete asset lifecycle management including inventory tracking, employee allocation, verification workflows, and audit trails. The system supports three user roles (Admin, Verifier, Employee) with role-based access control across all features.

Key capabilities:
- Employee master management with bulk import/export
- Dynamic asset type definitions with configurable field schemas
- Asset allocation, return, reallocation, and replacement workflows
- Verifier module for asset verification with image uploads
- Admin dashboard with real-time statistics and charts
- Complete audit trail logging
- PDF acknowledgement generation and notification support

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

Pages are organized in `client/src/pages/` with a `LayoutShell` component providing consistent sidebar navigation. Role-based navigation filtering happens in the layout shell.

### Backend (`server/`)
- **Framework**: Express.js with TypeScript, run via `tsx` in development
- **Authentication**: Passport.js with `passport-local` strategy, session-based auth stored in PostgreSQL via `connect-pg-simple`
- **Password Security**: `bcryptjs` for password hashing
- **File Uploads**: `multer` with disk storage to `client/public/uploads/`
- **API Design**: RESTful JSON APIs under `/api/` prefix. Route definitions are shared between client and server via `shared/routes.ts`
- **Build**: esbuild bundles server code to `dist/index.cjs` for production; Vite builds client to `dist/public/`

### Database
- **Database**: PostgreSQL (required, connection via `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-validation integration
- **Schema location**: `shared/schema.ts` — single source of truth for all table definitions
- **Migrations**: Drizzle Kit with `drizzle-kit push` command (no migration files workflow, direct push)

### Key Database Tables
- `users` — Authentication with role (admin/verifier/employee), lock status, failed attempts tracking
- `employees` — Employee directory with emp_id, branch, department, designation, contact info
- `asset_types` — Dynamic asset categories with JSON schema field definitions
- `assets` — Individual assets with serial numbers, status tracking, and dynamic fields stored as JSONB
- `allocations` — Asset-to-employee assignments with status (Active/Returned)
- `verifications` — Verification records with approval/rejection workflow
- `audit_logs` — System-wide activity logging

### Shared Layer (`shared/`)
- `schema.ts` — Drizzle table definitions, Zod insert schemas, TypeScript types exported for both client and server
- `routes.ts` — API route contracts (paths, methods, input/output Zod schemas) used by both sides for type safety

### Authentication & Authorization
- Session-based authentication with PostgreSQL session store
- Role-based page access enforced on frontend via `ProtectedRoute` wrapper
- Role-based navigation filtering in sidebar
- Account lockout after failed login attempts
- Forced password change on first admin login
- Three roles: `admin` (full access), `verifier` (verification + image upload), `employee` (view-only own assets)

### Build & Deployment
- Development: `npm run dev` runs tsx with Vite dev server middleware (HMR)
- Production build: `npm run build` runs Vite for client + esbuild for server
- Production start: `npm start` serves from `dist/`
- Database sync: `npm run db:push` uses Drizzle Kit to push schema to PostgreSQL

## External Dependencies

### Database
- **PostgreSQL** — Primary data store. Required via `DATABASE_URL` environment variable. Used for application data and session storage.

### Key NPM Packages
- **drizzle-orm** + **drizzle-kit** — ORM and migration tooling for PostgreSQL
- **express** + **express-session** — HTTP server and session management
- **passport** + **passport-local** — Authentication
- **bcryptjs** — Password hashing
- **connect-pg-simple** — PostgreSQL session store for Express
- **multer** — Multipart file upload handling
- **@tanstack/react-query** — Server state management on frontend
- **recharts** — Dashboard charts
- **shadcn/ui** (Radix UI + Tailwind) — Component library
- **zod** + **drizzle-zod** — Schema validation shared between client and server
- **wouter** — Client-side routing
- **xlsx** — Excel import/export functionality
- **jspdf** + **jspdf-autotable** — PDF generation for asset acknowledgements
- **date-fns** — Date formatting utilities
- **nanoid** — Unique ID generation

### Replit-Specific
- `@replit/vite-plugin-runtime-error-modal` — Runtime error overlay in development
- `@replit/vite-plugin-cartographer` — Dev tooling (development only)
- `@replit/vite-plugin-dev-banner` — Dev banner (development only)