# Provider onboarding: end-to-end check (curl)

Script: `docs/agents/provider-onboarding-e2e.sh` (bash + curl + node). Last run: **69 checks, 0 failures**.

```
cd backend && npx tsx src/server.ts            # PORT=5055 in this example; needs OTP_HASH_SECRET only for the admin OTP flow
BASE=http://localhost:5055/api bash docs/agents/provider-onboarding-e2e.sh
```

Needs the department admins `audit.tow@motexa.test` (MANAGE_TOWING) and `audit.parts@motexa.test` (MANAGE_SPARE_PARTS) plus the dev
customer `customer@motexa.test` (dev seed, password `Motexa-Dev-1234!`). Every run creates two NEW owners
(`e2e.tow.<time>@motexa.test`, `e2e.shop.<time>@motexa.test`, password `Owner-Pass-123!`).

## Tow company

| # | Step | Endpoint | Expected |
|---|------|----------|----------|
| 1 | register the owner (weak data is refused) | `POST /auth/provider/register` | 201 (400) |
| 2 | sign in, read the DRAFT application | `POST /auth/login`, `GET /provider/onboarding` | 200, `DRAFT` |
| 3 | unapproved owner tries a provider action | `GET /tow/me/requests`, `PATCH /tow/me/requests/:id/accept` | **403** "not been approved" |
| 4 | step 1: information (saved on the server) | `PUT /provider/onboarding/info` | 200 |
| 5 | submit while items are missing | `POST /provider/onboarding/submit` | 400 + `missing` |
| 6 | add a truck with photo, vehicle licence, insurance | `POST /tow/me/trucks` (existing endpoint) | 201 |
| 7 | step 2: documents (PNG, PDF; a non-image is refused) | `POST /provider/onboarding/documents` | 201 (400) |
| 8 | submit | `POST /provider/onboarding/submit` | 200 `PENDING` |
| 9 | edit after submit | `PUT /provider/onboarding/info` | **409** |
| 10 | `audit.tow` sees it under New | `GET /admin/providers/tow/applications?tab=NEW` | 200 |
| 11 | `audit.parts` on the tow application / tow admin on parts / the owner on the admin API | `GET /admin/providers/...` | **403** |
| 12 | approve before the checklist passes | `POST .../approve` | **409** `checklist` |
| 13 | request changes (message required; field + document flagged) | `POST .../request-changes` | 200 `NEEDS_CHANGES` |
| 14 | owner sees the flags and the message, replies | `GET /provider/onboarding`, `GET/POST /provider/messages` | 200 / 201 |
| 15 | resubmit while the rejected document is still there | `POST /provider/onboarding/submit` | **400** `rejected:` |
| 16 | owner replaces the document, resubmits | upload + submit | 201, 200 `PENDING` |
| 17 | admin reads the reply; company not visible to customers yet | `GET .../messages`, `GET /catalog/tow/companies` | 200 |
| 18 | accept every document (a reject needs a reason) | `PATCH .../documents/:docId` | 200 (400) |
| 19 | `audit.parts` tries to approve | `POST /admin/providers/tow/.../approve` | **403** |
| 20 | `audit.tow` approves | `POST .../approve` | 200 `APPROVED` |
| 21 | **company is visible to customers**; provider actions work | `GET /catalog/tow/companies`, `GET /tow/me/requests` | 200 |
| 22 | thread stays after approval; attachment opens for the owner and the tow admin, not for the parts admin | `POST /provider/messages`, `GET /files/private/:id` | 201, 200, 200, **403** |
| 23 | unread badge appears and clears | `GET /provider/onboarding/status`, `POST .../messages/read` | 200 |

## Parts shop

Same pattern: register (201), unapproved shop is refused on `POST /parts/me/products` and `GET /parts/me/inquiries` (**403**),
step 1 with categories, brands and map pin, four documents (storefront photo, commercial registration, trade licence, owner ID),
submit (`PENDING`), approve before the checklist (**409**), `audit.tow` on the shop application (**403**), accept documents,
reject without a reason (400), approve (200), **the shop appears in `GET /catalog/shops`**, thread list (200).
Private files: tow admin and customer get **403** on a shop document, the parts admin gets 200.

## Notes

- The approval checklist is computed by the server (`services/provider-onboarding.ts`): phone, map location, every required company
  document ACCEPTED, tow: at least one truck whose photo, vehicle licence and insurance are all ACCEPTED, shop: at least one category.
  Approving also approves the qualifying trucks in the same transaction.
- `PENDING` in the enum means "submitted, waiting for review" (the existing value is reused; only `DRAFT` and `NEEDS_CHANGES` were added).
- While `PENDING` the owner cannot edit anything (info, documents, trucks); `NEEDS_CHANGES` unlocks editing again.
