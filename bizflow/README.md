# BizFlow — Enterprise Business Management Platform

A comprehensive SaaS ERP system built as an enterprise monorepo, powering inventory management, sales tracking, employee management, financial reporting, and more.

## Architecture

```
bizflow/
├── apps/
│   ├── web/              ← Next.js ERP Web Application (production)
│   ├── mobile/           ← Flutter Mobile App (in development)
│   └── api-docs/         ← API Documentation (Swagger/OpenAPI)
│
├── packages/             ← Shared libraries & configs
│   ├── shared-types/     ← TypeScript type definitions
│   ├── api-contracts/    ← API request/response schemas
│   ├── ui-tokens/        ← Design tokens (colors, spacing)
│   ├── eslint-config/    ← Shared ESLint configuration
│   └── tsconfig/         ← Shared TypeScript configuration
│
├── docs/                 ← Project documentation
├── infrastructure/       ← DevOps, CI/CD, Docker configs
└── .github/workflows/    ← GitHub Actions
```

## Quick Start

```bash
# Install dependencies
cd apps/web
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Run development server
npm run dev
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript, TailwindCSS 4 |
| **Backend** | Next.js API Routes, NextAuth v5 |
| **Database** | Neon Serverless Postgres, Prisma ORM 7 |
| **Email** | Resend, React Email |
| **PDF** | @react-pdf/renderer |
| **Charts** | Recharts |
| **Mobile** | Flutter (planned) |
| **Deployment** | Vercel |

## Workspaces

| Workspace | Status | Description |
|-----------|--------|-------------|
| `apps/web` | ✅ Production | Main ERP web application |
| `apps/mobile` | 🚧 Planned | Flutter mobile app |
| `apps/api-docs` | 🚧 Planned | Swagger/OpenAPI documentation |
