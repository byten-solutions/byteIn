# byteInn

<p align="center">
  <img src="public/logo.png" alt="byteInn Logo" width="128" />
</p>

byteInn is an internal, reception-operated room management application (Property Management System). Reception staff create bookings, manage guests and room allocations, handle check-in/check-out workflows, and record payments. There is no customer-facing booking portal in V1.

---

## 1. Verified Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **UI & Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (preset `b1FQgLLmK`)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Language**: TypeScript 5
- **Database & ORM**: PostgreSQL via [Prisma ORM](https://www.prisma.io/) (v6)
- **Deployment Model**: Modular monolith — unified Next.js application (Frontend + Route Handlers) backed by PostgreSQL.

---

## 2. Getting Started

### Prerequisites
- Node.js (v20+ recommended)
- PostgreSQL database instance

### Environment Setup
Copy the example environment configuration to `.env`:
```bash
cp .env.example .env
```
Update `DATABASE_URL` with your PostgreSQL credentials:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/byteinn?schema=public"
```

### Installation & Prisma Setup
```bash
# Install dependencies
npm install

# Validate & generate Prisma client
npx prisma validate
npx prisma generate

# Apply database migrations
npx prisma migrate dev
```

### Development & Build Scripts
```bash
# Start local development server (http://localhost:3000)
npm run dev

# Run TypeScript compilation check
npx tsc --noEmit

# Run ESLint check
npm run lint

# Build production bundle
npm run build

# Start production server
npm run start
```

---

## 3. Architecture & Conventions

- **Unified Next.js Monolith**: Next.js App Router hosts both frontend UI pages and REST API Route Handlers (`src/app/api/...`).
- **Thin Route Handlers**: Route handlers validate incoming requests and delegate business logic to domain services under `src/modules/`.
- **Database Source of Truth**: All data models and relations are governed by `prisma/schema.prisma` and detailed in `docs/byteInn_Database_Design_v1.md`.
- **Backend-First Data Operations**: Pagination, search, sorting, and date filtering are processed in PostgreSQL queries via Prisma, never in frontend memory.
- **Monetary Precision**: All currency and prices are stored using PostgreSQL `numeric` / Prisma `Decimal`. Floating-point numbers are prohibited for financial calculations.

---

## 4. Documentation Index

Detailed specifications and architectural decisions reside under `docs/`:

| Document | Description |
| :--- | :--- |
| [byteInn_Architecture_v1.md](docs/byteInn_Architecture_v1.md) | High-level system context, technology boundaries, module responsibilities, and V1 exclusions. |
| [byteInn_Database_Design_v1.md](docs/byteInn_Database_Design_v1.md) | PostgreSQL schema, entities, relationships, constraints, and status lifecycles. |
| [byteInn_Low_Level_Architecture_v1.md](docs/byteInn_Low_Level_Architecture_v1.md) | API boundaries, request flows, transaction requirements, and state transition logic. |
| [byteInn_Implementation_Plan_v1.md](docs/byteInn_Implementation_Plan_v1.md) | Phased implementation roadmap (Phases 1–8) and core acceptance criteria. |
| [AGENTS.md](AGENTS.md) | Primary instruction file for AI agents, engineering rules, and living documentation protocol. |
| [prisma/README.md](prisma/README.md) | Database conventions, migration workflow, and relational constraints. |
| [src/README.md](src/README.md) | Source directory structure, API conventions, and client/server component boundaries. |
