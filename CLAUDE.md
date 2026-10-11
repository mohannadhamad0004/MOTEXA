# MOTEXA

Car-maintenance marketplace (graduation project).

Customers upload a photo, video or audio of a car problem, an AI gives a
preliminary diagnosis, and a mechanic confirms or corrects it.

MOTEXA is a community platform hosting many independent parts shops
(each with its own account) that sell parts; tow companies tow cars;
admins verify certifications.

## Roles

Exact role spelling:

- `customer`
- `mechanic`
- `parts_shop`
- `tow`
- `admin`

In web code use the constants in:

`apps/web/src/authorization/roles.js`

Use:

- `ROLES`
- `ROLE_LABELS`

`parts_shop` and `tow` are company accounts, not individuals.

Old names — do not reintroduce them:

- `driver` → now `tow`
- `shop owner` / `shop_owner` → now `parts_shop`

Role-specific UI:

- Parts Shop UI:
  - page: `PartsShopDashboard.jsx`
  - route: `/parts-shop`
  - label: `Parts Shop`

- Tow UI:
  - page: `TowDashboard.jsx`
  - route: `/tow`
  - label: `Tow` / `Tow company`

Public marketplace:

- `/marketplace` — search parts across all shops
- `/shops/:shopId` — one shop's public page

Prices are in ILS (`₪`).

---

# Repository Layout

```text
apps/web/          React web app (Vite, JavaScript, CSS Modules)
apps/mobile/       React Native app (not initialized yet - only feature folders exist)
apps/api/          Node.js + Express backend, PostgreSQL
packages/shared/   Types, API client and validation shared by web + mobilenpm 