# Sketchfab replacement pilot

**Blocked before authentication: runtime network EACCES on the identity endpoint, with no HTTP response.** Token validity/download authorization is unknown.

Three targets selected, zero evaluated; zero searches, candidates, downloads, preparations, renders or replacements. No target is marked NO_ACCEPTABLE_REPLACEMENT because candidate evaluation never began.

| Target | Planned query (not executed) | Current asset | Triangles | Bytes | Outcome |
|---|---|---|---:|---:|---|
| mercedes-c-class-w204 | Mercedes-Benz C-Class W204 2007 2014 sedan | backend/public/3d/mercedes-c-class-w204.glb | 561833 | 4802336 | BLOCKED_NOT_EVALUATED |
| bmw-1-series-f20-f21 | BMW 1 Series F20 F21 2011 2019 hatchback | 3d-source/bmw-1-series-f20-f21/optimized.glb | 768 | 34304 | BLOCKED_NOT_EVALUATED |
| volkswagen-golf-mk7 | Volkswagen Golf Mk7 VII 2012 2020 hatchback | backend/public/3d/volkswagen-golf-mk7.glb | 426418 | 6699392 | BLOCKED_NOT_EVALUATED |

W204 retains its current source assembly defect classification. No replacement UID, creator, license, new filename, generation verification, complexity comparison or accessory evaluation is available. No Sketchfab result was retrieved.

Resume from these targets in a session with permitted Sketchfab API access. Verify identity and download authorization first; stop on HTTP authentication failure. Gather 3-5 generation-specific downloadable, license-compatible candidates per target, preserve UID/source archives in staging, prepare and render all serious candidates using local Three.js 0.160.1, compare against current evidence, and stop after these three targets. No mass replacement.

Do not scale the workflow yet: API reliability, authorization, license filtering, preparation and candidate comparison remain unproven.

The stale served Corolla filename in CREDITS.md was corrected after verifying the existing E170/E180 asset, matching source UID, creator Armored Wave, and CC BY 4.0 attribution against the manifest and mobile configuration. Original source filename/provenance was preserved.
Stage B targets remain W204, BMW F20/F21 and Golf Mk7. Host identity authentication has not been proven. No sandbox outbound request was retried, and no search/download/candidate evaluation/promotion occurred. Run this from normal host PowerShell in the repository root with SKETCHFAB_ACCESS_TOKEN already present in that shell's environment:

~~~powershell
node .\backend\scripts\sketchfab-host.mjs --auth
~~~

Do not paste the credential into source or the chat. The helper only reads SKETCHFAB_ACCESS_TOKEN and uses Bearer authentication; there is no legacy-token fallback. It never logs the token, profile or signed download links. HTTP 401, HTTP 403 and NO_HTTP_RESPONSE failures are distinct. A successful identity check writes only sanitized status to ignored 3d-source/sketchfab-candidates/host-auth.json. This verifies identity, not download authorization. Stop on failure and report the sanitized message.

After host identity succeeds:

~~~powershell
node .\backend\scripts\sketchfab-host.mjs --search
~~~

The search mode is limited to the three pilot keys and derives queries/year ranges from actual audit entries, using downloadable=true. It stores UID/title/creator/license/counts/popularity/date metadata. Results still require generation/body-style review to select 3-5 serious candidates. Download only a reviewed UID from those results:

~~~powershell
node .\backend\scripts\sketchfab-host.mjs --download --target=mercedes-c-class-w204 --uid=REVIEWED_UID
~~~

The download endpoint separately verifies authorization. Only downloadable CC0/BY/BY-SA metadata is admitted; provenance legitimacy still needs review. Original GLB or glTF archive is staged under target/UID and never published. Existing source files are not overwritten. No automatic preparation or promotion runs in this helper; downloaded candidates return to Codex for safe staging preparation, local rendering, comparison and acceptance. Identity has not yet been proven, so network-dependent work stops at this handoff. None of the three is marked NO_ACCEPTABLE_REPLACEMENT because candidates remain unevaluated. Do not scale this workflow yet.
