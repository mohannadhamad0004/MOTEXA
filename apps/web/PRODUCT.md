# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

All roles are equally important; no single primary audience.
- `customer`: car owner with a problem, often stressed and on a phone; uploads a photo, video or audio, gets an AI preliminary diagnosis, requests a mechanic, tow or parts. No dashboard; reaches `/my-cars`, `/ai-agent`, `/chats`, `/reports` from the account menu.
- `mechanic`: independent professional; confirms or corrects the AI diagnosis, offers on-site / workshop / online consultation, holds approved skills and certificates.
- `parts_shop`: company account selling parts on a shared marketplace; manages only its own parts (`/parts-shop`).
- `tow`: company account with trucks; answers tow and emergency requests (`/tow`, `/tow/trucks`).
- `admin`: verifies accounts, skills, certificates, trucks, parts and reviews (`/admin/*`).

## Product Purpose

MOTEXA is a car-maintenance marketplace (graduation project). A customer uploads evidence of a car problem, an AI gives a preliminary diagnosis, and a verified mechanic confirms or corrects it. It also hosts independent parts shops and tow companies, and has an Emergency flow that dispatches the nearest tow trucks or on-site mechanics. Success: a customer goes from problem to trusted, completed service, then reviews it and gets a printable report.

## Positioning

AI-first triage backed by human-verified providers: every public provider is admin-approved (verification method recorded, skills approved one by one), and the AI diagnosis is always a preliminary opinion a mechanic confirms.

## Operating Context

Customers are often mobile and in urgent situations (Emergency button, maps, pin pickup). Admins work on desktop review queues (`/admin/approvals`, `/admin/reviews`). Prices in ILS (₪). Public pages (`/marketplace`, `/shops/:shopId`, `/mechanics`, `/tow-companies`) need no login and show only approved, non-suspended accounts without contact details or documents.

## Capabilities and Constraints

- Stack: React (Vite, JavaScript), CSS Modules, react-router v8; Node/Express + PostgreSQL API; mobile app (React Native) not initialized.
- AI provider keys stay server-side; only the api diagnosis module talks to the provider.
- Authorization is enforced by the api; web checks are UX only.
- Roles use exact names `customer`, `mechanic`, `parts_shop`, `tow`, `admin` (never "driver" or "shop owner").
- Mobile first; check 375px, 768px and 1280px. Dark mode via `prefers-color-scheme`.
- Open decision: production map tile provider (OSM tiles are development only).

## Brand Commitments

Existing design tokens in `apps/web/src/styles/variables.css` with an orange accent that requires dark text, not white. Shared components in `apps/web/src/components/` are the required UI vocabulary.

## Evidence on Hand

Mock data lives in web pages and seeds the api (`// TODO: replace with real API call`). No real testimonials, customer counts or metrics exist; do not fabricate them.

## Product Principles

1. Trust is earned visibly: verification status, approved skills and reviews are first-class, never decoration.
2. Urgency-aware: the customer path (diagnose, emergency, tow) stays fast and legible under stress on a phone.
3. The AI advises, a human confirms; always label AI output as preliminary.
4. One system for five roles: shared components and tokens, role-specific content.
5. Privacy by default: no contact details or customer location exposed until the flow requires it.

## Accessibility & Inclusion

WCAG AA text/background contrast, visible focus ring, keyboard operable. Arabic + English required: layouts must support RTL (use logical CSS properties) and bilingual copy.
