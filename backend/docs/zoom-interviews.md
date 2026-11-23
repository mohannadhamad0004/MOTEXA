# Automatic Zoom interview invitations

The mechanic-admin Decision screen creates a 30-minute Zoom meeting when Online
meeting is selected. No meeting-link entry is needed. The backend stores the
participant join URL with the appointment, writes an audit event containing the
Zoom meeting ID, and sends an in-app notification. The mechanic can open the link
and confirm attendance. Interview outcome and final approval remain separate
administrator decisions; creating a meeting never approves a mechanic.

## One-time account setup

1. Sign in as the project Zoom account owner at https://marketplace.zoom.us/.
2. Create and activate a Server-to-Server OAuth application.
3. Add granular scopes `meeting:write:meeting:admin` (creation) and
   `meeting:delete:meeting:admin` (cleanup of a newly created meeting if saving fails).
4. Add the following to `backend/.env` locally. Never put these values in mobile
   environment variables, source control, screenshots or chat messages.

```dotenv
ZOOM_ACCOUNT_ID=
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=
ZOOM_HOST_USER_ID=
```

The host value is the Zoom user ID or email of the project account member who
will host the interviews. Restart the backend after configuring the account.
The administrator should sign in to that Zoom account to host the meeting;
the application only distributes the participant URL, never the privileged
`start_url`. Account policies, permissions and rate limits still apply.

## Verification

Use a pending test application, choose a future date/time and Online meeting,
then select Create Zoom & send invitation. Verify the meeting exists in the
host's Zoom account and the mechanic sees the same date and participant link.
Confirm attendance as the mechanic, then record the interview result as admin.
An actual appointment cannot be marked complete before its start time. The
explicit simulation setting permits early outcome testing and is recorded in
the audit trail; it still creates a real Zoom meeting when using this integration.

Invitations are in-app notifications, not emails, SMS or push notifications.
No webhook claims the meeting happened or that the applicant passed. Approval
requires the recorded interview result and other existing verification gates.

Missing configuration returns 503; provider failures return 502. Neither case
sends an invitation or replaces the current appointment. A stale appointment
ID blocks replays before contacting Zoom. Concurrent changes are rechecked under
the database row lock; a newly created unused meeting is deleted on save failure.
Cleanup failures log the meeting ID for the account owner to remove manually.
Network timeouts can leave an uncertain external result: inspect the Zoom host's
meeting list before retrying. Rebooking replaces the application appointment;
previous successfully scheduled Zoom meetings remain in the host's Zoom calendar
and should be removed there if no longer needed.

## Automated checks (no real Zoom requests)

```powershell
npm run build
node --test --test-concurrency=1 tests/zoom-meeting.test.mjs tests/mechanic-workflow.test.mjs tests/mechanic-progress.test.mjs
```

Service tests stub provider HTTP. The workflow test uses isolated temporary DB
fixtures and stubs only Zoom requests; no existing applicant is changed. A live
Zoom account check is still required after configuration.

Official references:
- https://developers.zoom.us/docs/internal-apps/s2s-oauth/
- https://developers.zoom.us/docs/api/meetings/
