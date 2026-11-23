# Mechanic service requests

The approved mechanic workspace has a Requests destination and a service-desk
summary backed by PostgreSQL. Fonts and photography are local assets; the wordmark,
cream/chocolate palette and existing floating-navigation presentation are retained.

## API

All endpoints below use a current ACTIVE-account Bearer session.

- POST /api/service-requests/ — CUSTOMER creates a request for an ACTIVE, VERIFIED
  mechanic offering the selected mode. Body: mechanicId, clientRequestId (8–80
  characters), mode (WORKSHOP / ON_SITE / ONLINE), title, description, vehicle,
  contactNumber, address (required for ON_SITE). A customer-scoped idempotency key
  returns the existing request for an identical retry; conflicting details return 409.
- GET /api/service-requests/customer — the signed-in customer's requests only.
- GET /api/service-requests/mechanic — the approved mechanic's latest 100 requests,
  counts for all statuses and the response limit. Counts are not fabricated on errors.
- POST /api/service-requests/:id/action — assigned mechanic only. Body: action,
  current version, optional note. DECLINE requires a reason of at least 3 characters.
- POST /api/service-requests/:id/cancel — owning customer only; NEW requests only,
  with the current version.

Transitions: NEW -> ACCEPTED -> IN_PROGRESS -> COMPLETED; NEW -> DECLINED by the
mechanic, or NEW -> CANCELLED by the customer. Row locks and versions reject stale
or duplicate transitions. In-app notifications and audit records are committed in
the same transaction as each change. Approval and enabled service modes are checked
on the backend, not only through hidden buttons. DTOs exclude passwords, email and
verification-document contents.

## Current scope

The mechanic inbox, actions and customer API are implemented. The customer screen
for submitting requests remains part of the customer journey and is not added by
this change. No demo requests are seeded into the real mechanic's account.
Appointments, pricing, payments and customer chat are separate features; request
acceptance does not create a charge or appointment. The existing conversation
remains the administrator conversation.

The service list displays the latest 100 records and shows that limit when reached;
pagination and real-time push are not implemented. Refresh is available explicitly
and when the mechanic workspace is focused. Network failures show an error rather
than reporting zero requests.

## Validation

`npm run build`

`node --test --test-concurrency=1 tests/service-requests.test.mjs tests/mechanic-workflow.test.mjs tests/mechanic-progress.test.mjs`

Tests create tagged temporary users and requests and remove them afterward. They
exercise ownership, role/approval gates, replay handling, competing accepts,
completion, decline, cancellation, notifications and preserved verification gates.
