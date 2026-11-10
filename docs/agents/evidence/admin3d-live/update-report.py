from pathlib import Path
import json
import re

root = Path(__file__).resolve().parents[4]
report = root / 'docs/agents/BUGS-ADMIN-3D.md'
evidence = Path(__file__).parent
prefix = 'evidence/admin3d-live/'
def link(name):
    return f'[{name}]({prefix}{name})'

results = {
'A-01': ('CONFIRMED', 'Live BMW X5 E53 check: PATCH isActive=false returned 200; taxonomy retained isPublished=true and model3dKey, and the 390px browser displayed "3D available / Inactive". Management published=false and customer runtime excluded the key. Active state restored (200). '+link('A-01-A-03.json')+'; '+link('A-01-inactive-generation.png')),
'A-02': ('CONFIRMED', 'Opened Add generation in the real authenticated Parts Admin UI. Its controls are Model, Generation code, display names, production years and Active; no body-type control exists. No record saved. '+link('browser-forms.json')+'; '+link('A-02-generation-form.png')),
'A-03': ('CONFIRMED', 'Unpublished existing BMW X5 E53 through the real management API (200). Authenticated GET /admin/parts/part-maps/bmw-x5-e53 then returned 404 NO_3D_CAR; customer runtime omitted the key. Republishing succeeded (200). Confirms hidden-model review failure; a new private import was not created. '+link('A-01-A-03.json')),
'A-04': ('NOT REPRODUCED', 'Read-only motexa_dev SQL: 22 published generations; zero without any generation revision and zero without a revision matching the current model3dKey. Requested missing-generation list is empty. Management and customer runtime each returned 22 models at baseline. Conditional legacy risk remains, but its prerequisite is absent here. '+link('final-database-check.json')+'; '+link('inventory-api.json')),
'A-05': ('CONFIRMED', 'Real browser selected the existing BMW X5 GLB with its retained provenance, but entered an HTTP source URL. Backend rejected upload with 400 INVALID_SOURCE / "Use an HTTPS source URL." UI replaced it with the generic GLB/size/provenance error. Import count stayed 4. '+link('A-05-live.json')+'; '+link('A-05-upload-failure.png')),
'A-06': ('CONFIRMED', 'On published BMW X5 E53, changed groundOffset from 0 to 0.01 via real config PATCH (200). Management still reported published=true; the customer runtime immediately delivered groundOffset=0.01 while part-map status remained PROPOSED. Restored 0 through the API (200). The selected map was already unconfirmed; no confirmed map was invalidated. '+link('A-06-live.json')),
'B-01': ('NOT REPRODUCED', 'The real private bumper candidate has no usable final preview and its fit fails. POST preview returned 400 FIT_FAILED (rear bumper mapping not confirmed); the published wing has an old preview but its current fit is stale. Could not exercise a successful second render on a mounted review screen. Image-key source concern remains unverified, not disproved. '+link('B-01-B-03-C-01-prerequisites.json')),
'B-02': ('CONFIRMED', 'Opened real successful Meshy candidate caeb5d60-6561-49e7-8770-2db3fabe4b4b in final review. Screen offers generated-model preview, part-map review, blocked publication and Discard private candidate; no regenerate/replacement action is present. No discard or paid generation executed. This confirms the missing action for the current success state; post-discard state was not exercised. '+link('browser-forms.json')+'; '+link('B-02-successful-candidate.png')),
'B-03': ('NOT REPRODUCED', 'Inspected all three published accessories through the real admin API. Every current target fit was missing or stale (current=false), so unpublish/reactivate was not attempted: the restore gate would not have a current allowed fit. No shop-notification transition was exercised. Source omission remains a hypothesis awaiting a reversible qualifying record. '+link('B-01-B-03-C-01-prerequisites.json')),
'C-01': ('NOT REPRODUCED', 'Read-only live SQL found 3 PUBLISHED and 1 READY_FOR_FINAL_REVIEW accessories; zero DRAFT/REJECTED editable records. The existing roof-rack product opens the Create 3D request form, not a saved editable draft. No photo mutation or fabricated draft was created; unsaved-edit reset remains unverified. '+link('B-01-B-03-C-01-prerequisites.json')+'; '+link('C-03-probe.json')),
'C-02': ('CONFIRMED', 'In the real seeded shop product wizard, entered price 12abc and stock 1.9. Browser submitted price=12 and stock=1; API returned 200; read-only SQL showed 12.00 / 1. Restored original 32.50 / 24 through the API, verified by SQL. '+link('C-02-live.json')+'; '+link('C-02-malformed-input.png')),
'C-03': ('CONFIRMED', 'Real Arabic shop form: width input retained ASCII 1500, then became empty after filling Arabic-Indic ١٥٠٠. No save performed. '+link('C-03-live.json')+'; '+link('C-03-arabic-input.png')),
'D-01': ('CONFIRMED', 'Authenticated Tow Admin POST review with decision REQUEST_CHANGES returned 400: "decision must be APPROVE, REJECT or SUSPEND." Real driver page exposes Pending/Approved/Rejected/Suspended and Suspend for the three approved rows, with zero Request changes controls. No review decision changed. '+link('D-01-D-02-api.json')+'; '+link('D-01-D-02-ui.json')),
'D-02': ('CONFIRMED', 'Real Tow Admin driver page has zero Edit controls. PATCH to the existing company driver-edit endpoint with Tow Admin credentials returned 403 "Tow company access required." Source route review found no admin editor endpoint. No profile changed by this check. '+link('D-01-D-02-api.json')+'; '+link('D-01-D-02-ui.json')),
'D-03': ('NOT REPRODUCED', 'Live SQL contains only 3 drivers, all APPROVED; authenticated admin GET returned all 3. The >200 prerequisite is absent, so truncation cannot be demonstrated against current data. No artificial drivers were inserted. The source take:200 limitation remains conditional. '+link('final-database-check.json')+'; '+link('inventory-api.json')),
'D-04': ('NOT REPRODUCED', 'Navigating to the real /admin/requests page redirected to login after /api/api/auth/me returned 404 (new D-05). Could not reach the source-level Coming soon placeholder. A separate preview launch was rejected by automatic approval review (blocked by policy); no auth interception or fabricated session response used. '+link('D-05-login-redirect.json')),
'E-01': ('CONFIRMED', 'Seeded company owns driver 465fcc78-0cac-45ba-8e03-17d7b163ee29 on an existing EN_ROUTE job. PATCH containing that driver\'s unchanged truckId returned 409 "Change the truck after the current job." No job/truck state changed. This isolates the wizard payload field causing the failure. '+link('E-01-E-02.json')),
'E-02': ('CONFIRMED', 'Changed a free seeded driver\'s offline flag false -> true through the real company API (200). Read-only SQL confirmed true, while AuditLog count for that driver stayed 0 -> 0. Restored false through the API (200), verified by SQL. '+link('E-01-E-02.json')),
'F-02': ('CONFIRMED', 'On the real customer wing product, Chromium network denial blocked accessory requests while the product endpoint returned 200. Entire 3D/installed-look section disappeared with no error/retry. After unblocking and reload, Installed look returned. No response stubs or backend changes. '+link('F-02-F-03-live.json')+'; '+link('F02-network-failure.png')),
'F-03': ('CONFIRMED', 'On the real customer wing product, blocked only installed-photo requests in Chromium. Product and accessory endpoints returned 200; all three photo requests failed, yet three Loading placeholders persisted through the observation and polling period with no retry. Unblocking and reload produced successful image responses and cleared Loading. No response stubs. '+link('F-02-F-03-live.json')+'; '+link('F03-network-failure.png')),
}
expiry_file=evidence/'E-03-expiry.json'
if expiry_file.exists():
    expiry=json.loads(expiry_file.read_text())
    assert expiry['lifetimeSeconds']==900 and expiry['beforeStatus']==200 and expiry['after']['status']==401
    results['E-03']=('CONFIRMED', 'Used a genuine Parts Admin login token for its actual 900-second lifetime, without clock changes or token minting. Management GET returned 200 before expiry and 401 after expiry; /auth/me also returned 401. Source client redirects authenticated 401 to login. API expiry is reproduced; a physical-phone active-job interruption was not tested. '+link('E-03-expiry.json'))
else:
    results['E-03']=('PENDING', 'Real server-issued 900-second token is being retained in memory for its actual expiry; management GET initially returned 200. No accelerated clock or minted token. '+link('E-03-running.json'))

s=report.read_text(encoding='utf-8')
lines=[]
for line in s.splitlines():
    match=re.match(r'^\|[^|]*\| ([A-F]-\d\d) \|',line)
    if match and match.group(1) in results:
        status,actual=results[match.group(1)]
        cells=line.split('|');cells[1]=' '+status+' ';cells[8]=' '+actual+' ';line='|'.join(cells)
    lines.append(line)
s='\n'.join(lines)+'\n'
new='| CONFIRMED | D-05 | General admin (Partner file) | mobile/src/app/admin/(tabs)/_layout.tsx:45 | Valid admin session is redirected to login when API configuration ends in /api. | With EXPO_PUBLIC_API_URL=http://127.0.0.1:5000/api and a valid Tow Admin token, open /admin/requests. | Normalize the base URL as the department API does and load the admin area. | Browser requested /api/api/auth/me, received 404 and navigated to /auth/login. Control /api/auth/me with the same role returned 200. '+link('D-05-login-redirect.json')+'; '+link('D-05-api-control.json')+' | MAJOR | Admin tab layout appends /api/auth/me to a value that already contains /api; use shared apiUrl normalization. |'
if not re.search(r'^\|[^|]*\| D-05 \|',s,re.M):
    pos=s.index('\n',s.index('| NOT REPRODUCED | D-04 |'))
    s=s[:pos]+'\n'+new+s[pos:]

# Replace historical overview/feature tables; retain every original finding except removed F-01.
heading=s.index('## A. Parts admin')
intro='''# MOTEXA — Admin, 3D, shop, tow and customer bug audit

Date: 2026-11-09. Branch: `ui/blueprint`. Live follow-up against the existing working tree, running backend and PostgreSQL. No application source fixes, migrations, commits or pushes.

## Summary

**22 retained rows: 21 original rows plus new D-05.** F-01 was removed as instructed: full plate after assignment is permitted; masked before assignment. Original severity classifications are retained (1 BLOCKER, 15 MAJOR, 6 MINOR); severity does not imply reproduction.

STATUS_COUNTS

**NOT REPRODUCED is not a pass or a claim of a fix.** A-04 and D-03 lack the triggering data. B-01, B-03 and C-01 lack usable workflow prerequisites. D-04 is blocked by newly confirmed D-05. Each row states the actual evidence and limits; original reproduction procedures are retained separately from actions performed.

| Area | Confirmed | Not reproduced | Total |
|---|---:|---:|---:|
| A — Vehicle 3D | 5 | 1 | 6 |
| B — Accessory 3D | 1 | 2 | 3 |
| C — Shop forms | 2 | 1 | 3 |
| D — Tow/general admin | 3 | 2 | 5 |
| E — Company/session | E_CONFIRMED | 0 | 3 |
| F — Customer results | 2 | 0 | 2 |

## Live environment and evidence

- Backend `http://127.0.0.1:5000/api/health`: **200**. Direct PostgreSQL connection: **motexa_dev**, `transaction_read_only=on`. All direct SQL was read-only; state changes used authenticated application APIs only.
- Real seeded logins succeeded for customer, shop, company, Parts Admin and Tow Admin. Browser used the existing Expo web server at `http://127.0.0.1:8085`, Chrome, 390×844. Authentication used genuine `/auth/login` tokens in browser session storage; no token minting or auth response replacement.
- All UI/API evidence uses real backend data. F-02/F-03 intentionally denied specific requests using Chromium's network controls, then unblocked them and reloaded; there were no response fixtures, mocks, seeds or isolated test databases.
- Evidence and repeatable scripts: [admin3d-live](evidence/admin3d-live/README.md). JSON records include API status, selected SQL results and UI text; screenshots accompany visual findings. Provider task IDs are identifiers, not provider credentials. No credentials, bearer tokens or signed URLs were saved.
- A-04 first: **22 published generations; 0 without any generation revision; 0 without a current-key revision**. Missing-generation list: **[]**. Baseline management and customer APIs each returned 22 models. No reconciliation script was run.

```sql
SELECT g.id, v.make, v.model, g.code, g."yearFrom", g."yearTo", g."model3dKey"
FROM "VehicleGeneration" g
JOIN "Vehicle" v ON v.id = g."vehicleId"
WHERE g."isPublished" = true
  AND NOT EXISTS (
    SELECT 1 FROM "Vehicle3DRevision" r WHERE r."generationId" = g.id
  )
ORDER BY v.make, v.model, g.code;
```

The current-key check substitutes `r.key = g."model3dKey"`. Both result sets were empty: [SQL and empty result sets](evidence/admin3d-live/A-04-read-only.json). [Final SQL verification](evidence/admin3d-live/final-database-check.json).

'''
if expiry_file.exists():
    intro=intro.replace('STATUS_COUNTS','**16 confirmed; 6 not reproduced with explicit limits.**').replace('E_CONFIRMED','3')
else:
    intro=intro.replace('STATUS_COUNTS','**15 confirmed; 6 not reproduced; E-03 timed expiry check still running.**').replace('E_CONFIRMED','2 + 1 pending')
s=intro+s[heading:]
s=re.sub(r'\n### Feature status\n.*?(?=\n## [A-F]\. |\n## Not checked)', '\n',s,flags=re.S)
cutoff='\n## Not checked' if '\n## Not checked' in s else '\n## State changes and restoration'
s=s[:s.index(cutoff)]+'''
## State changes and restoration

- BMW X5 E53: deactivated/reactivated taxonomy; hid/republished 3D; changed ground offset 0 → 0.01 → 0. Final SQL confirms active=true, published=true, offset=0. Its map started PROPOSED and remained unconfirmed. Normal API processing regenerated its segmentation and publication metadata mirrors; model revision counters, timestamps and audit rows intentionally retain those operations.
- Existing seeded brake-pad product: malformed wizard input saved price 12 / stock 1, then restored 32.50 / 24 via API and verified by SQL. Two product-edit audit rows remain.
- Existing free seeded driver: offline false → true → false, restored and verified. The missing audit rows are the reproduced E-02 defect. Existing EN_ROUTE job and truck assignment were untouched.
- Rejected upload created no import (count 4 before and after). Rejected driver decision and preview attempt did not create a paid task or alter approval. No new accounts, products, drafts, photos, imports, provider tasks or tow jobs were created. No Meshy credits spent, Sketchfab imports started, notification decisions sent, files deleted or database writes issued directly.
- [Final database checks](evidence/admin3d-live/final-database-check.json) record restored business values and retained audit actions. Existing unrelated work was preserved.

## Limits and remaining verification

- B-01 needs an editable, successfully fitted candidate and two successful preview renders while its review screen remains mounted. The available private bumper returned FIT_FAILED.
- B-03 needs a published accessory with a current allowed fit so unpublish/reactivate can be completed and restored. All three published records currently fail that prerequisite; they were left published.
- C-01 needs an existing editable draft and a real photo mutation; none of the four existing accessories is editable. No fabricated measurement/photo record was introduced.
- D-03 needs more than 200 drivers in a status; this database has three. D-04 requires D-05's URL issue to be corrected or a working alternate preview. Automatic approval review rejected a separate preview launch with `blocked by policy`; no bypass was attempted.
- Android/Expo Go, native picker/camera/GPS/backgrounding and physical-device session interruption remain untested. Browser evidence includes 390px English dark screens and the Arabic size form; it is not comprehensive dark/light/RTL acceptance.
- The session check proves real elapsed server expiry and resulting API rejection, not a completed customer-company-driver journey. Full 3D publication/fit/render acceptance was not performed, and unobserved behavior is not reported as passing.

## Checks

- Backend and mobile `npx --no-install tsc --noEmit`: both PASS, exit 0 after the live audit.
- Mobile `npx --no-install eslint src --no-cache --format json`: could not run; ESLint 9.39.5 found no eslint.config.js/mjs/cjs (exit 1). No lint configuration was created.
- No schema changes; Prisma validation not required.
- Final report checks: all 21 retained original IDs present; F-01 absent as a finding; D-05 appended; evidence links resolve; no unresolved status once the timed check finishes.
- Git status inspected; no commit or push.
'''
report.write_text(s,encoding='utf-8')
print('Updated',report)
