# Mobile review — 2026-10-18

Reviewed branch `feature/mohannad-mobile`, the last five commits (`fe90e75`, `8934389`, `5b568f6`, `bbb298c`, `d365927`) using log/show, staged and unstaged diffs, and the new untracked theme/UI/core files. References below use current working-tree line numbers. Findings are sorted by severity.

1. **Medium — GPS coordinates can make nearest-company requests fail.** `backend/src/routes/catalog.routes.ts:275`: `readPoint` rejects coordinates with more than ten decimal places, but `useCurrentLocation.tsx:85` preserves native GPS precision and `catalogService.ts` serializes it unchanged. For example, `32.221123456789` is inside the service area but returns HTTP 400, breaking the nearest list and company details with that position. **Fix:** validate finite numeric coordinate strings and bounds without the ten-decimal restriction, or consistently round coordinates before sending.

   Status: Fixed — backend/src/routes/catalog.routes.ts (readPoint accepts up to 15 decimals), mobile/src/core/constants/geo.ts (roundPoint, 6 decimals), useCurrentLocation.tsx and maps.tsx (all GPS and pin coordinates rounded to 6 decimals)

2. **Medium — Older loads can overwrite the current screen's data.** `mobile/src/core/hooks/useLoad.ts:11`: requests have no generation check, cancellation, or focus cleanup. On an ID/dependency change or overlapping refresh, the older promise can resolve last and replace the newer record; an older failure/finally can also replace the error/loading state. This hook drives customer details and requests. **Fix:** associate each load with a generation and ignore superseded responses; invalidate on blur/unmount and dependency changes, or abort requests.

   Status: Fixed — mobile/src/core/hooks/useLoad.ts (generation counter: only the newest load writes state; invalidated on blur/dependency change; reload returns its promise)

3. **Medium — Reverse geocoding can pair the wrong address with the pickup pin.** `mobile/src/app/customer/towrequest/new.tsx:46`: every pin movement launches an independent lookup. An older lookup can finish after a newer one, overwrite a manually edited address, or populate the address after the pin is removed. Submission is allowed while lookups run. **Fix:** use a lookup generation tied to the current point, invalidate it on manual edits/removal, and apply results only while that generation and automatic-address mode remain current; debounce map moves.

   Status: Fixed — mobile/src/app/customer/towrequest/new.tsx (lookup generation + 400 ms debounce; manual edit or removing the pin cancels the pending lookup)

4. **Medium — Location permission explanation allows overlapping unresolved requests.** `mobile/src/features/shared/useCurrentLocation.tsx:59`: `locating` becomes true only after permission handling (line 79). While the explanation dialog is open, location buttons remain enabled; a second call overwrites `answer.current`, leaving the first promise unresolved. **Fix:** mark the entire operation busy before permission checks, coalesce/reject duplicate calls, and settle the pending explanation promise during cleanup.

   Status: Fixed — mobile/src/features/shared/useCurrentLocation.tsx (busy from the start, duplicate calls share one in-flight promise, pending explanation settled on unmount)

5. **Medium — Failed map mode offers no usable company list.** `mobile/src/app/customer/(tabs)/tow.tsx:194`: map mode suppresses the company cards even if the WebView fails. The map's failure message says the list below still works, but only a previously selected company can appear there; a first-time offline map has no selectable company. **Fix:** propagate map failure and render the list automatically, or always render company cards below the optional map.

   Status: Fixed — mobile/src/app/customer/(tabs)/tow.tsx + maps.tsx (CompaniesMap reports failure via onFailedChange; the company list is shown automatically when the map cannot load)

6. **Medium — Map failure detection stops working after the first tile succeeds.** `mobile/src/features/shared/maps.tsx:58`: `tilesOk` is a lifetime count; failure is reported only when it is zero. After one successful tile, losing connectivity and panning to an uncached area leaves a blank/partial map without a failure state. The native overlay also requires `!tiles`, so later WebView errors are hidden. **Fix:** track current tile-loading cycles and current failures, show recoverable failure UI after subsequent errors, and provide a retry/reload action.

   Status: Fixed — mobile/src/features/shared/maps.tsx (failures counted per load cycle, recover on the next tile, banner with Reload after the first tile, Retry before it)

7. **Medium — WebView bridge messages lack runtime validation.** `mobile/src/features/shared/maps.tsx:123`: the TypeScript annotation does not validate parsed JSON. A valid JSON `null` throws at `m.type`; truthy non-string IDs pass through, and out-of-range coordinates reach pickup state. `originWhitelist={["*"]}` at line 144 also allows unrestricted top-level navigation without a navigation guard. **Fix:** validate a non-null object and exact message schema, require selected IDs to exist in current pins, validate finite coordinates/bounds and movable mode, and block unexpected top-level navigation while permitting required map subresources.

   Status: Fixed — mobile/src/features/shared/maps.tsx (exact message-shape validation, ids must exist in current pins, finite in-range coordinates only when movable, onShouldStartLoadWithRequest blocks navigation away from the page)

8. **Medium — Map memoization can keep obsolete company IDs.** `mobile/src/features/shared/maps.tsx:193`: dependencies include coordinates and availability but omit pin IDs and names. If refresh/filter results replace a company with another at the same rounded base or city centre and the same availability, the map retains the old ID/name. Tapping its pin cannot select the replacement company. **Fix:** include all serialized pin fields in the memoization key, or memoize the complete pin array upstream and depend on it.

   Status: Fixed — mobile/src/features/shared/maps.tsx (CompaniesMap memo keyed on the full serialized pins and position)

9. **Medium — Text contrast fails in both themes.** `mobile/src/theme/tokens.ts:45` and `:77`: `textDim` is used for meaningful small text such as part fitment, shop names, request previews, and field placeholders. Against `surface`, the dark pair is approximately 3.06:1 and the light pair 3.84:1, below 4.5:1 for normal text. **Fix:** darken/lighten the relevant tokens to meet 4.5:1 on every background where small text uses them, or reserve the current colors for decorative content.

   Status: Fixed — mobile/src/theme/tokens.ts (textDim dark #9C8A7D / light #735B46, textMuted dark #B5A090; at least 4.5:1 on surface)

10. **Medium — Shared controls miss the required 44px touch target.** `mobile/src/components/ui/Chip.tsx:32`, `mobile/src/components/ui/Button.tsx:10`, and `mobile/src/components/ui/Input.tsx:73`: chips have only 16px vertical padding plus small text, small buttons explicitly use 38px minimum height, and the search clear control is 19px plus 16px padding (35px), without hitSlop. **Fix:** give each control a minimum 44×44 target or suitable non-overlapping hitSlop while retaining the visual size.

   Status: Fixed — components/ui/Chip.tsx (min height 44), Button.tsx (small buttons get hitSlop to 44), Input.tsx (clear button hitSlop)

11. **Medium — Long car-filter labels can overflow the screen.** `mobile/src/components/ui/Button.tsx:68`: button text has neither `flexShrink` nor a width constraint. `ProductBrowser.tsx` builds the “Fits my car” label from unrestricted make/model input and places it beside an icon and horizontal padding. Long valid values exceed the available width at 390px. **Fix:** constrain/shrink the text within the button and allow wrapping with a defined alignment or truncation policy; verify long English and Arabic car names.

   Status: Fixed — mobile/src/components/ui/Button.tsx (label shrinks, wraps to 2 lines, centered)

12. **Medium — Arabic city search cannot match the stored city names.** `mobile/src/app/customer/(tabs)/tow.tsx:122` (city search) and `backend/src/routes/catalog.routes.ts:296`: the Arabic UI sends the entered service-area text directly, while the server compares only English `SERVICE_CITIES` names and English stored city strings. Typing `نابلس` returns no companies even when Nablus is served. **Fix:** use localized city selections that send canonical names, or normalize Arabic aliases on the server before filtering.

   Status: Fixed — mobile/src/core/constants/cities.ts (cityToEnglish) used by the Tow tab search, so an Arabic city name is sent as the stored English name

13. **Low — Home refresh completes before its network requests.** `mobile/src/app/customer/(tabs)/index.tsx:61`: `reload()` returns void, so wrapping its result in `Promise.resolve` makes `allSettled` complete immediately and dismisses the refresh indicator while requests are pending. **Fix:** return the load promise from `useLoad.reload` and await it, or derive Home's refreshing state from its active loads.

   Status: Fixed — mobile/src/core/hooks/useLoad.ts + customer Home index.tsx (reload returns the promise and refresh awaits all three loads)

14. **Low — Refresh failures disappear when tow results already exist.** `mobile/src/app/customer/(tabs)/tow.tsx:184`: errors render only when `items` is empty. After a successful list, a failing refresh/filter request leaves stale results visible without an error, including potentially obsolete availability. **Fix:** show a retryable error alongside retained results and make their stale/loading state clear.

   Status: Fixed — mobile/src/app/customer/(tabs)/tow.tsx (retryable error notice shown above retained results)

Validation and coverage: mobile `npx tsc --noEmit` and backend `npx tsc --noEmit` both exited 0. No schema changes were made, so Prisma validation was not applicable. The installed Expo SDK's `bundledNativeModules.json` lists the added `react-native-webview` version `13.16.1`; no unsupported-native-module mismatch was identified statically. Leaflet is pinned to 1.9.4 and OSM attribution is present. Customer catalog/inquiry/tow response builders omit provider phone/email/plate/licence fields, and private provider files require owner or matching admin access; no direct structured-field privacy leak was found in those routes. No native device, screen-reader, offline WebView, or 390px rendering test was performed. STATUS.md was absent at review start. Code was not edited.
