> Historical milestone, superseded by [the complete Car Owner delivery and verification](car-owner-complete-journey.md). The user subsequently authorized the full journey and the one-active-service concurrency rule. The older approval boundary below is historical.

# Car Owner: visual review milestone — 16 November 2026

Scope: Home and vehicle presentation first, pending the user's visual approval before further redesign. Preserve the existing backend. The reference informs composition; MOTEXA supplies chocolate/bronze colors, Manrope/Cairo typography, wordmark, M watermark, themes and shared floating role tabs.

## Implemented
- Home: retained actual driving footage in a compact cinematic frame, genuine selected-vehicle data, layered vehicle card and actual active-request status. Existing service launcher retained.
- Garage: saved-vehicle collection, circular make filters, large ghost model typography behind the original car photo, compact year/fuel/selection chips, circular details action.
- Vehicle details: same vehicle art, actual year/fuel, existing edit/remove/select/service actions.
- Runtime car photography: narrowly matched 2018 Corolla; original Toyota badge retained. A vector UI clip displays the unchanged original photo. No rejected/generated sedan is used. Unknown models receive an explicit placeholder.
- Shared FloatingRoleTabs restored. No separate owner navigation style.
- Dark preview starts independently of saved app preferences. Header theme switch and Arabic/English remain functional.
- Fixed optional empty-string rendering in customer/owner Views that triggered React Native's development error toast.

## Functional boundaries
Production uses the existing authenticated customer APIs. Existing add/select/edit/archive, directory/profile, request send/cancel, account update and status refresh remain connected. No backend source/schema/database architecture change belongs to this visual milestone.

/customer-preview is development-only, uses isolated fixtures, never calls business APIs, and never writes an access token. /customer remains the real authenticated journey. The preview's in-memory actions are not evidence of PostgreSQL persistence.

## Verification
- Final `npx tsc --noEmit` passed. Scoped ESLint for modified owner/customer/auth components passed.
- Browser matrix: Arabic/English × dark/light × 320/390 px. Exercised vehicle edit, service selection, mechanic profile, request form/review/send/cancel, history and account edit. Eight cases passed before the final compact Home spacing adjustment. Preview API isolation and no token creation were asserted.
- After final Home spacing edits, captured Home/Garage in Arabic/English and dark/light. No browser errors or horizontal overflow. Actual HTML video playback verified: playing, readyState 4, currentTime advancing. No static UI mockup substituted for implementation.

## Limitations / next review
- Visual approval is pending; do not claim equivalence to the reference.
- Curated matching car photography currently covers only Corolla 2018. Do not invent other model images.
- Physical Android device visual/performance testing remains to be performed.
- Parts, towing, AI and payments remain future scope.
- Backend persistence tests from the preceding implementation are separate from this frontend visual review.

Main components: OwnerHome, OwnerVehicleCard, OwnerCatalogPhoto, OwnerGarage, OwnerScroll, CustomerAutomotiveHero, CustomerWorkspace; shared FloatingRoleTabs, MechanicUI and design tokens retained.

Rejected sedan asset and unused alternate owner navigation files were removed. Shared FloatingRoleTabs is the only owner tab implementation.
