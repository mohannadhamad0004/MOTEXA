# 10 — One UI system for provider and admin screens

> **Approved 2026-11-25, built 2026-11-26.** Every provider / admin page below is on these templates; `mobile/tests/ui-system.test.mjs`
> fails when a page reachable from `app/dept`, `app/admin`, `app/provider`, `app/driver` or `app/mechanic` imports an old frame or kit
> again (by import text and by resolved file). Every new or touched provider / admin page must follow this file.

**Scope**: every screen of the parts shop, tow company, tow driver, mechanic, every department admin and the super admin, plus provider
onboarding. The customer side (and `work-with-motexa`, auth, `dev/*`) keeps its own Garage look. Built only from `components/manage/*`
and the Garage kit (`components/garage/*`, `theme/garage.ts`). Forbidden there: `components/ui/*`, `components/blueprint/*`,
`theme/useTheme`, `MotexaVisual`, `BrandSurfaces`, `EditorialUI`, `InteractiveButton`, `LoadingState`, `PremiumUI`, `MechanicUI`, the
`ProviderLayout` / `ProviderHeader` frames and the `DeptPage` / `GaragePage` / `MechanicPage` frames (the customer side still uses some
of them).

## 0. The kit (what to import)

| Need | Piece | File |
|---|---|---|
| any page | `Page` (← back + trail, title block with one line and ⋮, scroll / `list` / `hero` modes, sticky `footer`, `tabBar`, `trail`, `scrollRef`) | `components/manage/Page.tsx` |
| Detail bodies | `Block`, `Facts`, `CheckRow`, `History`, `DocRows`, `Loaded` (skeleton → error + Retry → content), `LogOut` (asks first) | `Page.tsx` |
| Dashboards | Mo hero (`HeroLayout`, departments: `AdminHero`), `NeedsRow` (hidden at 0), `Kpis` ("—" until real), shortcut `ManageEntry` rows | `Page.tsx`, `features/department/adminHero.tsx` |
| Lists | `ManagePage` (header, segmented `tabs`, search, `filters`, `above`, rows, bulk bar, sheet / side panel), `ManageRow` (+ `actions` ⋮, `leading`), `FilterChips`, `ManageEntry`, `appStatus` | `components/manage/ManagePage.tsx` |
| Forms | `SmartPicker` ("+ Add '…'"), `StepperHeader`, `StepFooter`, `useDiscardGuard`, `ReasonSheet`, Garage `Field` / `Toggle` / `Chip` | `components/manage/Form.tsx`, `components/garage` |
| Inbox | `ThreadRow` (in a `ManagePage`), `ThreadPage` (polling, mark read, attachments, ⋮, `closed` note) | `components/manage/Thread.tsx` |
| ⋮ menus | `ItemAction[]` (confirm / reason / choices, toast) | `components/ItemActionsMenu.tsx` |
| trail | `core/nav/crumbs.ts` (labels + logical parents; every new sub-page path gets a label or an override there) | |

## 1. Pick one template per page

| Template | Use it for | Shape |
|---|---|---|
| **List** | many items of one kind to find, filter and act on | `ManagePage`: header, optional tabs, search, one chip row, compact rows, sticky bulk bar; tap = sheet (phone) / side panel (≥ 900 px) or the item's own page |
| **Detail** | one item: its facts and its one main action | `DetailPage`: header (+ ⋮ for secondary actions), status line, sections of label/value rows, sticky footer with the one primary action |
| **Form** | create / edit; a **step flow** when there are more than ~8 fields or later fields depend on earlier ones | `FormPage`: header, fields (smart pickers), optional `Stepper` (progress, Back / Next), sticky primary (Save / Next / Submit) |
| **Inbox** | conversations | `InboxPage` (rows: name, last message, time, unread dot; search + one chip row) → `ThreadPage` (bubbles, composer pinned at the bottom) |
| **Dashboard** | a role's home tab or a hub | `DashboardPage`: the Mo hero (title, one real data line, one action), "Needs you now" rows with counts (each opens a filtered List), real KPI tiles, shortcuts as `ManageEntry` rows |

Maps are a Detail whose body is the full-bleed map. Settings / profile hubs are a List of `ManageEntry` rows.

## 2. Header, trail, back
- **The same `PageHeader` on every page**: ← back (tab roots have none), the trail, the title (max 2 lines), **one short line max** (a real
  fact such as "22 cars · 19 to confirm", never instructions), optional ⋮ with the page's secondary actions.
- **Trail** above the title: `Parts admin › 3D models › W202 import`. Each page names itself once with `useCrumb("W202 import")`; the trail is
  the navigation stack. Tapping a crumb returns to that page by popping the stack (`router.dismissTo`), so Android back keeps working the
  same afterwards. A page opened by a deep link (no history) gets its parents from one route table (`core/nav/crumbs.ts`). On phones the
  trail is one line; middle crumbs collapse to "…" (tap = the full list).
- **Android back = the ← button.** Leaving a Form with unsaved changes asks first ("Discard changes?").

## 3. Lists
- **Rows, never big cards**: `ManageRow` (64 px): title / one second line / one status chip / ⋮. Wide lists may show columns.
- **Filters = one chip row with counts** (`Rail`), "All" first, at most ~5 chips; more → a "Filters" sheet. No chips on two rows, no
  wrapping chip walls, no pill buttons as filters.
- **Tabs** (segmented `Tabs`) only for different views of the same subject, max 3–4, the same control everywhere.
- Search on every list that can pass ~10 items. Sort by what needs action first ("To confirm", "Failed", "Waiting").
- Bulk work: checkboxes + the sticky bulk bar; "Select all matching" for server-side selections.

## 4. Actions
- **At most one primary button per page** (sticky footer on Detail / Form, the hero action on a Dashboard). Secondary actions go in ⋮ or
  are ghost buttons; destructive ones are in ⋮, ask for confirmation, and ask for a reason when another person is affected.
- **No button for what can happen by itself**: a pasted link is checked automatically (debounced), a picked generation fills its years,
  a search runs while typing.

## 5. Forms and smart pickers
- `SmartPicker` for any choice from more than ~6 options: a field that opens a searchable list (sheet on phones, popover on wide),
  suggested items on top. When nothing matches, the list itself ends with **"+ Add '‹typed text›' as a new brand / model / generation"**;
  it asks only the extra fields it needs (Arabic name, production years) inline and selects the new item. No separate "Create …" buttons.
- Cascades (brand → model → generation): picking a parent clears the children; a generation fills its years.
- Labels above fields, errors under the field in plain words, numeric keyboards for numbers (Arabic digits accepted).

## 6. States
- Loading = skeleton rows; empty = one sentence + the one action that fixes it; error = plain words + Retry (`ManagePage` already does this).
- No fake data: a number is hidden until it is real (`AGENTS.md`).

## 7. Language, theme, size
- Every string `t(en, ar)`; RTL through `row` / `align`; Latin codes inside Arabic through `isoLatin`.
- Light + dark through Garage tokens only (data colours such as part labels excepted).
- 390 px without overflow; List gets two panes from 900 px; content max width 760 (one pane) / 1240 (two panes); touch targets ≥ 44 px.
- Done means: tsc 0, tests, screenshots at 390 px EN dark + AR light and wide, no console errors.

## Appendix — every provider / admin page and its template

| Role | Dashboard | List | Detail | Form | Inbox |
|---|---|---|---|---|---|
| **Parts admin** (`dept/*`) | `(tabs)/index`, `3d/index` | `(tabs)/requests` (Shop applications \| 3D requests), `(tabs)/directory`, `3d/vehicles`, `3d/accessories`, `3d/requests`, `3d-submissions`, `accessory3d`, `vehicle3d`, `vehicles` (catalog), `vehicles/requests`, `orders`, `accessory-zones`, `accessory-fits`, `(tabs)/messages` (Inbox), `(tabs)/profile` (entry rows) | `review/[kind]/[id]`, `3d/vehicles/[key]`, `3d-submissions/[id]`, `accessory3d/[id]`, `vehicle3d/[id]`, `vehicles/[id]`, `vehicles/imports/[id]`, `orders/[id]`, part-map / zone editors, fit review; maps `map`, `directory-map`, `orders/map` | `3d/add` (also replaces the old `vehicles/imports/new`), `edit/product/[id]` (step flow), `edit/shop/[id]` | `thread/[kind]/[id]` |
| **Tow admin** (`dept/*`) | `(tabs)/index` | `(tabs)/requests`, `(tabs)/directory`, `tows/drivers`, `tows/history`, `tows/reports` + the shared dept tabs | `tows/[id]`, `review/truck/[id]`; map `tows/index` | `edit/company/[id]`, `edit/truck/[id]` | shared dept tabs |
| **Mechanics admin** (`dept/*`) | `(tabs)/index` | `(tabs)/requests` (Mechanic requests \| Applications), `(tabs)/directory` (verified mechanics) + the shared dept tabs | `review/mechanic/[userId]` (application review), `mechanic-requests/[id]` | — | shared dept tabs |
| **Super admin** (`admin/*`) | `(tabs)/index` | `(tabs)/providers`, `(tabs)/requests`, `admin-management` (invite = a Form sheet), `(tabs)/more` (entry rows), `shops/index`, `tow/index` (the dept directory pages with ←) | `profile` (read only: no edit endpoint), `shops/[id]`, `tow/[id]` | — | — |
| **Parts shop** (`provider/parts/*`) | `(tabs)/index`, `analytics` | `(tabs)/products`, `inventory`, `fitment`, `(tabs)/orders`, `orders/list`, `inquiries/index`, `3d/index`, `3d/submissions`, `categories`, `(tabs)/profile` + `settings` (entry rows) | `products/[id]`, `orders/[id]`, `3d/preview/[productId]`; map `orders/map/[id]` | `[id]` + `products/edit/[id]` (step flow), `accessory-3d/[productId]` (step flow), `business`, `delivery`, `media` | `(tabs)/messages`, `motexa`, `orders/chat/[id]`, `inquiries/[id]` |
| **Tow company** (`provider/tow/*`) | `(tabs)/index`, `stats` | `(tabs)/jobs` (= `dispatch`, `active`, `history`), `(tabs)/fleet` (= `drivers`, `trucks`), `(tabs)/profile` + `settings` (entry rows) | `requests/[id]`, `dispatch/[id]`, `[id]` (truck); maps `live`, `service-area` | driver / truck wizards, `availability`, `company`, `media` | `(tabs)/messages`, `motexa` |
| **Tow driver** (`driver/*`) | `index` | — | `job/[id]` (its steps, one confirmed step in the footer) | — | `job/chat` |
| **Mechanic** (`mechanic/*`) | `index` once approved / while waiting | `requests/index` | `requests/[id]` | `index` while applying (step flow) | — |
| **Onboarding** (`provider/onboarding/*`) | — | — | `location` (map) | `index` (step flow) | `messages` |

`provider/parts/preview` and `provider/tow/preview` stay in the customer look on purpose: they show the shop / company as customers see it.
Removed on the way (no screen used them): `provider/tow/requests/index` (Jobs is the list), `dept/vehicles/imports/new` (Add 3D model),
`admin/departments` (every department admin lands in `/dept`, which has the department switcher).
