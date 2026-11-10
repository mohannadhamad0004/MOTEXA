# Live admin/3D audit evidence — 2026-11-09

These artifacts support [BUGS-ADMIN-3D.md](../../BUGS-ADMIN-3D.md). They were collected against the real backend on port 5000, PostgreSQL `motexa_dev`, and existing Expo web server on port 8085. No API response fixtures or synthetic authentication were used. Direct SQL connections set `default_transaction_read_only=on`.

| Findings | Primary evidence |
|---|---|
| A-01 / A-03 | `A-01-A-03.json`, `A-01-inactive-generation.png` |
| A-02 | `browser-forms.json`, `A-02-generation-form.png` |
| A-04 | `A-04-read-only.json`, `final-database-check.json`, `inventory-api.json` |
| A-05 | `A-05-live.json`, `A-05-upload-failure.png` |
| A-06 | `A-06-live.json` |
| B-01 / B-03 / C-01 limits | `B-01-B-03-C-01-prerequisites.json` |
| B-02 | `browser-forms.json`, `B-02-successful-candidate.png` |
| C-02 | `C-02-live.json`, `C-02-malformed-input.png` |
| C-03 | `C-03-live.json`, `C-03-arabic-input.png` |
| D-01 / D-02 | `D-01-D-02-api.json`, `D-01-D-02-ui.json` |
| D-03 | `final-database-check.json`, `inventory-api.json` |
| D-04 blocked / D-05 | `D-05-login-redirect.json`, `D-05-api-control.json` |
| E-01 / E-02 | `E-01-E-02.json` |
| E-03 | `E-03-running.json`, `E-03-expiry.json` after actual expiry |
| F-02 / F-03 | `F-02-F-03-live.json`, `F02-network-failure.png`, `F03-network-failure.png` |

The `*_api*`/`_admin_*`/`_catalog_*` JSON snapshots preserve real baseline API data. `inventory-sql.json` contains three initial SQL column/table-name errors; corrected queries are in `inventory-corrected.json` and the final database check. Those diagnostic errors are not application bugs. `browser-probe.*` records the port-8081 startup skeleton; it was not used to claim a workflow result. `browser-forms.json` retains an initial wait failure on “Save details”; the actual new form says “Create 3D request,” as recorded by `C-03-probe.json` and the successful Arabic check.

Scripts use dependencies already installed in `backend` and `mobile`. Run from the repository root with `node docs/agents/evidence/admin3d-live/<script>.cjs`. `common.cjs` reads the existing development login password from the seed source and backend database configuration without printing or saving credentials. Tokens exist in process memory and temporary browser session storage only.

Replay effects matter: `vehicle-live.cjs`, `geometry-live.cjs`, `product-numbers.cjs`, and `tow-live.cjs` perform real reversible API edits on the specific existing records, restore business values in `finally`, and leave normal revision/timestamp/audit history. They are audit procedures, not isolated automated tests. The geometry procedure refuses to invalidate a confirmed map. `session-expiry.cjs` takes the server-issued 15 minutes. `customer-failures.cjs` uses Chromium network denial for selected endpoints and subsequently unblocks them; it does not stub responses. No script starts paid generation or imports from Sketchfab.

Screenshots are browser evidence, not Android/Expo Go verification. The report distinguishes reproduced behavior, missing prerequisites, and source-only explanations.
