# NARA Technical Documentation
*Niatkan, Atur, Rancang, Aksi — The Integrated Personal Master App.*

## 1. Project Overview
NARA is a personal productivity and health management platform built as a high-performance Web PWA. It integrates three core pillars:
- **RAGA**: Nutrition and health tracking.
- **ARTA**: Granular financial management.
- **MASA**: Unified task and routine scheduling.

---

## 2. Technology Stack
### Frontend
- **Framework**: Vite + React + TypeScript
- **Styling**: Tailwind CSS
- **Components**: Shadcn/UI (Radix UI)
- **Animations**: Framer Motion
- **PWA**: `vite-plugin-pwa` for offline support and mobile installation.

### Backend & Storage
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (Google OAuth)
- **Real-time**: Supabase Realtime for data sync.

### Orchestration & Integration
- **Engine**: n8n
- **Communication**: Webhooks (POST) for all complex logic and multi-step workflows.

---

## 3. System Architecture
NARA follows an "Orchestration-First" architecture. Instead of direct database calls for complex logic, the frontend communicates with **n8n webhooks**, which then interact with Supabase and other services.

### Authentication Flow
1. User clicks "Login with Google".
2. Supabase Auth handles OAuth handshake.
3. On successful login, the frontend triggers a `SIGNED_IN` event.
4. Frontend fetches user metadata and sends a POST request to the **NARA Auth Webhook** in n8n.
5. n8n performs an **Upsert** operation on the `profiles` table to ensure user data is provisioned/updated.
6. User is redirected to `/dashboard`.

---

## 4. Module Implementations

### 4.1 RAGA (Health & Nutrition)
- **Database Tables**: `raga_logs` (daily entries), `profiles` (biometrics like height, weight, activity).
- **Features**:
  - BMI Calculator with an interactive visual scale.
  - TDEE (Total Daily Energy Expenditure) calculation based on biometrics.
  - Calorie logging and macro tracking balance.
  - "NARA AI Assistant" insights based on health data.

### 4.2 ARTA (Financial Recap)
- **Database Tables**: `arta_categories` (income/expense categories), `arta_transactions`.
- **Features**:
  - **Dual-Panel Wealth View**: Simultaneous display of Income and Expenses.
  - **Stacked Analysis**: Visual containers grouping wealth flow for clear comparison.
  - Expense/Income balance reporting via n8n orchestration.
  - Granular per-item transaction logging.

### 4.3 MASA (Task & Routine)
- **Database Tables**: `masa_tasks` (one-off tasks), `masa_routines` (recurring daily/weekly rituals).
- **Features**:
  - **Unified Agenda**: Integrated view of both scheduled rituals and pending tasks.
  - **Routine Timeline**: Vertical chronological visualization of daily requirements.
  - Priority-based task management.

---

## 5. UI/UX Design System
NARA features a dual-theme infrastructure known as the **Theme Engine**:

- **Neon Glow (Glassmorphism)**: Transparent-blur panels, neon accents, and vibrant glows for a high-tech feel.
- **Classic**: Solid, clean, and professional UI with standard borders and high readability.

**Theme Tokens**: Managed via CSS variables in `index.css` and toggled using `data-theme` on the `<html>` root.

---

## 6. Infrastructure & Deployment
- **Hosting**: Cloudflare Pages.
- **Routing**: Single Page Application (SPA) handling via `wrangler.jsonc` (`not_found_handling: "single-page-application"`).
- **Custom Domain**: `nara.dyudhiantoro.my.id`.
- **CI/CD**: Automatic builds via GitHub integration.

### Environment Variables
- `VITE_SUPABASE_URL`: Supabase project endpoint.
- `VITE_SUPABASE_ANON_KEY`: Public API key.
- `VITE_N8N_WEBHOOK_URL`: Base URL for n8n orchestrations.
- Module-specific webhook URLs (RAGA, ARTA, MASA).

---

## 7. Developer Guidelines
- **Logic Placement**: Prefer n8n for any logic that might need to be triggered by external events (e.g., WhatsApp integration) or requires complex branching.
- **Styling**: Avoid ad-hoc utility classes; use predefined theme tokens for consistency across Neon and Classic themes.
- **Components**: Keep components modular and reusable under `src/components`.

---
*Last Updated: 2026-03-16*
