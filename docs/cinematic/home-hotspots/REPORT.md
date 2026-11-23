# Owner Home — supplied photography and clickable service markers

Date:2026-11-18. Implements the owner's subsequent explicit Home request. This is separate from the dev-only Phase1 lab, whose default placeholders remain unchanged.

Changes: new OwnerAutomotiveHome.tsx + owner-home-media.ts. OwnerHome.tsx mounts this scene and removes the duplicated service-story block. Existing active request summary and My cars link remain. Existing bottom tabs, shared header, role/auth/API/backend/Prisma files were not edited. Before snapshot is OwnerHome.tsx.before.txt. Source-baseline delta is recorded in SCOPE.json.

Media: user-supplied showroom screenshots copied byte-for-byte to mobile/assets/cinematic/supplied; SOURCE.json/SOURCE-latest.json record dimensions, bytes and hashes. Latest active exterior1093x717, cockpit1255x761, dashboard1317x762. No AI generation or resampling/upscaling; no artificial4K claims. Deep zoom is bounded by source resolution. Mixed screenshots are not claimed to document the same physical car, model or dealership endorsement. No screenshot branding has been erased or altered. Earlier AI exterior remains rejected and unreferenced.

Motion: one anchored Home stage, native shared scroll progress; image scales/translates using source-coordinate focus points and reversible cockpit mask. Hotspots are children of the same camera layer and counter-scale their controls to retain usable size. Small service controls at the bottom directly open existing corresponding callbacks. No duplicated service-card story below. Original typefaces and theme tokens reused. No gold color grade added to photos.

VERIFIED: tsc noEmit and scoped ESLint passed. Browser tests390 English/dark and320 Arabic/light: mechanic marker opens all three existing modes, each lower service control opens corresponding real information screen, no duplicate service-story component, no page errors. Separate final-marker test clicked all four on-image markers at their scroll locations and verified their destinations. Actual recording actual-home.webm; screenshots final-home/final-mechanic/final-parts/final-towing/final-ai.png. These are fixture-preview UI tests, not proof of real backend booking or native performance.

IMPLEMENTED-UNTESTED: Android physical-device hotspot/scroll performance, mobile memory/texture loading under pressure. Existing API/real-session flows are reused unchanged, not retested against a new backend deployment in this visual task.

NOT DONE: spare-parts ordering, towing dispatch and actual AI diagnosis. Those existing pages remain honest about unavailable requests. No new backend features or data were fabricated. No changes to My cars, requests, account or other roles in this task.

Preview: http://localhost:58134/customer-preview?review=mercedes-hotspots (sample data, no sign-in). Authenticated owner route remains /customer.

## Subsequent owner refinements
Home now uses five selected clear user-supplied showroom PNGs: exterior1093x717, front1070x822, rear1206x785, cockpit1255x761, dashboard1317x762. All copied bytes unchanged. The demo3 HTML embedded JPEGs were also inspected/extracted (SOURCE-demo3.json), but larger dimensions did not establish sharper visual detail; latest explicit owner preference selects the clear PNG set. No 4K recovery, synthetic detail or image-generation enhancement is claimed.

Scene travel increased from1.8 to3.2 viewport heights (~78% more travel); repeated camera keys create stable reading/selection intervals. Front/rear/cockpit/dashboard reveals are scroll controlled and reversible. No forced snap or autoplay. Four service labels directly navigate, while on-image markers follow the relevant camera/scene.

Removed the Home active-request strip, personal-car strip and decorative footer/pause control at owner's explicit request. Requests and vehicles remain available through unchanged main navigation. Preserved actual Home notification entry. Source snapshot before cleanup: OwnerHome.before-cleanup.tsx.txt.

Latest validation: TypeScript and scoped ESLint pass; owner-home-hotspots.cjs passes390 English and320 Arabic for all service destinations; owner-home-hotspot-markers.cjs clicks every actual marker and records actual-home.webm. Zero page errors. Real Android performance remains unverified.
