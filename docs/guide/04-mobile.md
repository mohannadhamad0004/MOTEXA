# 04 — The mobile app (Expo + React Native)

## 1. Folder structure

```
mobile/
├─ app.json            name, scheme "motexa" (deep links), permissions text for location, plugins, typed routes
├─ package.json        Expo SDK 57, React Native 0.86, Expo Router; Playwright only as a dev tool
├─ .env                EXPO_PUBLIC_API_URL
├─ assets/             fonts (Cairo, IBM Plex Sans Arabic, Inter, …), images, the "Mo" mascot clips (assets/mo/)
├─ android/            the generated native Android project (not needed for Expo Go)
├─ tests/              20 Node test files on pure modules + tests/e2e Playwright scripts (manual)
└─ src/
   ├─ app/             every screen (Expo Router: the file path is the route)
   ├─ core/            app-wide plumbing
   │  ├─ config/api.ts         the API client (tokens, refresh, uploads, errors)
   │  ├─ session/              session.tsx (who is signed in), landing.ts, sessionExpiry.ts, errorText.ts, pendingSignup.ts
   │  ├─ constants/            cities, categories, money, geo, files, numbers, bidi (Arabic text helpers)
   │  └─ hooks/                useL (language), useLoad (load + poll), pickPhoto, nav
   ├─ features/        code per feature, used by the screens
   │  ├─ catalog/              parts browsing, filters, garage / "my car", vehicle picker, shop and tow public profiles
   │  ├─ orders/               cart (memory only), order service and pieces
   │  ├─ requests/             tow request form, active-request banner, request services
   │  ├─ tow/                  tow services, driver card, live jobs map, tow chat, provider pages
   │  ├─ fleet/                truck and driver wizards
   │  ├─ parts/                product form, parts services, provider pages
   │  ├─ mechanics/            mechanic request form, services, admin service, inbox menus
   │  ├─ provider/             application wizard (Onboarding), location picker, review chat, approved gate, portal
   │  ├─ providerhub/          the provider home, tabs and profile hub
   │  ├─ department/           every department-admin screen and its config (departments.ts)
   │  ├─ car3d/                the three.js viewer in a WebView (sceneHtml.ts), model download and cache
   │  ├─ accessory3d/          shop 3D wizard, admin review screens, customer "View on my car"
   │  ├─ vehicle3d/, vehicleCatalog/, vehicleRequests/   customer car models, catalog management, "request my car"
   │  ├─ shared/               maps (Leaflet WebView), location, routing (OSRM), service map screens
   │  └─ work/                 Work-with-MOTEXA texts
   ├─ components/      UI building blocks
   │  ├─ garage/               the "Mo's Garage" design system (customer + most newer screens)
   │  ├─ ui/                   the shared UI kit (Text, Button, Card, Input, Badge, Skeleton, StatusTimeline …)
   │  ├─ layout/               Screen, RoleGate, AuthLayout, DashboardLayout, ProviderLayout, tab bar options
   │  ├─ blueprint/            an earlier "blueprint" visual style (sheets, motion pieces, mascot hero)
   │  └─ *.tsx (top level)     the original components (Appearance, MotexaVisual, LanguageSwitch, SessionStore …)
   ├─ theme/           garage.ts (customer tokens), tokens.ts (provider / dept tokens), useTheme, photos.ts
   ├─ i18n/            LanguageContext.tsx, translations.ts (older auth / admin texts)
   └─ motion/          animation tokens, haptics, reduced-motion handling
```

Rule from `AGENTS.md`: no Tailwind / NativeWind / CSS on mobile; only `StyleSheet`, theme tokens and the shared components.

## 2. Screens per role (Expo Router)

Every folder below `src/app/` is an area with its own `_layout.tsx`. A `(tabs)` folder is a tab bar; `[id].tsx` is a screen with a
parameter. Each area's layout wraps it in a `RoleGate` (or its own check), which is **UX only**: the backend repeats every check.

| Area / route | Who | Main screens |
|---|---|---|
| `app/index.tsx` | everyone | 4-slide welcome story, then the sign-in screen |
| `app/auth/` | signed out | `login.tsx` (one sign-in for all roles), `signup.tsx` (customers), `verify-email.tsx` (6-digit code), `forgot-password.tsx`, `admin-activation.tsx` (invited admins) |
| `app/work-with-motexa.tsx` | customer (and signed-out explanation) | apply as mechanic / tow company / parts shop |
| `app/customer/(tabs)/` | `CUSTOMER` | `index` Home, `parts` shop, `mechanics`, `tow`, `profile` |
| `app/customer/*` | `CUSTOMER` | `garage`, `car3d` (my car in 3D), `parts/[id]` product, `shops/[id]`, `cart`, `checkout`, `order/[id]` (+ `chat`, `track`), `inquiry/*`, `towrequest/new` + `[id]` + `chat`, `tow/[id]` company, `tow/drivers`, `mechanic/[id]`, `mechanicrequest/new` + `[id]`, `requests` (all my requests), maps, `vehicle-requests/*`, `vehicle3d/[carId]` |
| `app/mechanic/` | `MECHANIC`, or a customer with a mechanic application | `index` (application or home), `requests/index` (inbox), `requests/[id]` |
| `app/provider/onboarding/` | tow / parts owner before approval, or a customer applicant | `index` (the application wizard), `location`, `messages` (thread with admins) |
| `app/provider/parts/` | `PARTS_PROVIDER` (approved) | tabs `index`, `products`, `orders`, `messages`, `profile`; `products/[id]`, `products/edit/[id]`, `orders/[id]` (+ chat, map), `inquiries/*`, `delivery`, `inventory`, `categories`, `analytics`, `media`, `settings`, `preview` (as customers see it), `accessory-3d/[productId]` (3D wizard), `3d/*` |
| `app/provider/tow/` | `TOW_PROVIDER` (approved) | tabs `index`, `jobs`, `fleet`, `messages`, `profile`; `requests/*`, `dispatch/*`, `drivers`, `trucks`, `live` (map of active jobs), `history`, `stats`, `availability`, `service-area`, `company`, `media`, `settings`, `preview` |
| `app/driver/` | `TOW_DRIVER` or an owner who drives | `index` (my status + jobs), `job/[id]` (steps, sends GPS while open), `job/chat` |
| `app/dept/` | `ADMIN` with a permission (also the super admin) | tabs `index` Home, `requests`, `directory`, `messages`, `profile` — the same five tabs for every department, filled from `features/department/departments.ts`; plus `review/[kind]/[id]`, `thread/[kind]/[id]`, `tows/*`, `orders/*`, `mechanic-requests/[id]`, `accessory3d/*`, `accessory-fits`, `accessory-zones`, `vehicles/*`, `3d/*`, `3d-submissions/*`, `vehicle3d/*`, `edit/*` (admin edits of a company / shop / truck / product), maps |
| `app/admin/` | `SUPER_ADMIN` | tabs `index` (dashboard), `providers`, `requests` (what waits in every department), `more`; `admin-management` (invite / suspend admins), `departments` (jump into a department), `profile`, `shops/*`, `tow/*` |
| `app/dev/` | developers only | `garage-lab`, `motion-lab`; both redirect away unless `__DEV__` |

After sign-in, `landingFor(role, permissions)` (`core/session/landing.ts`) picks the home; `mobile/tests/landing.test.mjs` checks that
every role's home is a real route.

## 3. Session and the API client

### 3.1 Where tokens live
`components/SessionStore.ts`: on the phone, `expo-secure-store` (Android keystore-backed storage); on the web preview,
`sessionStorage` (lost when the tab closes). Keys: `motexa_access_token`, `motexa_refresh_token` (`core/session/sessionExpiry.ts`).

### 3.2 `core/config/api.ts`
- `apiUrl(path)` builds the full URL from `EXPO_PUBLIC_API_URL`, with or without `/api`.
- `api(method, path, body)` is what screens call:
  1. `getAccessToken()` reads the access token and, if it expires in under 60 s (`expiresSoon` decodes the JWT `exp`), refreshes it.
  2. Sends the request with `Authorization: Bearer …`.
  3. On **401** it refreshes once and repeats the same request.
  4. If it still fails with 401, the session really ended: `sessionExpired()` clears the tokens, goes to `/auth/login` and shows
     "Your session expired" once, in the saved language.
  5. Other errors become an `Error` whose message is the English/Arabic text for the server's `errorCode`
     (`core/session/errorText.ts`), with `status` and `data` attached.
- **One refresh at a time** (`createRefresher` in `sessionExpiry.ts`): the server rotates the refresh token, so two parallel refreshes
  with the same token would look like theft and end the session. All callers share one running refresh.
- **Uploads**: a body over 120 KB is sent with `XMLHttpRequest` instead of `fetch`, so screens can show upload progress
  (`uploadProgress`).
- `saveSession()` after sign-in, `clearSession()` on sign-out (also revokes the refresh token on the server, best effort).
- `privateImageSource(path)`: an image source with the bearer header, for private documents (never a public URL).

### 3.3 Who is signed in
`core/session/session.tsx`: `useSession()` calls `GET /api/auth/me` (refreshing once on 401) and returns
`loading | none | ready(user)`. `RoleGate` (`components/layout/RoleGate.tsx`) shows a skeleton while loading, sends `none` to the
sign-in screen, shows "Access denied" for a wrong role, and otherwise provides the user to the area through `SessionProvider`.
The file also has small helpers: `isApplicant`, `canManageParts`, `canManageTow`, `canManageMechanics` — all marked as UX-only.

### 3.4 Loading data
`core/hooks/useLoad.ts`: loads on screen focus and when its inputs change; only the newest answer may update the screen; with
`pollMs` it re-reads silently while the screen is focused (e.g. a tow request every ~5 s). This polling is how "live" screens work;
there are no WebSockets.

## 4. The design system ("Mo's Garage")

There are three layers of visual code, from newest to oldest:
1. **Garage** (`components/garage/*` + `theme/garage.ts`): the warm "Mo's Garage" look used by customer screens and, since the
   latest commits, the heroes of every role. It has its own text (`GText`), buttons (`GButton`), cards, chips, notes, sheets, a
   floating tab bar (`GarageTabBar`), page frame (`GaragePage`), and the hero (`hero/HeroLayout.tsx`, configured by
   `hero/heroConfig.ts`: a title, one real data line, one action, and a "Mo" clip).
2. **Theme tokens** (`theme/tokens.ts`, "Blueprint Editorial", used via `useTheme()`): warm paper (light) / espresso (dark) with a
   bronze accent, plus `components/ui/*` (the shared kit) and `components/layout/*`. Provider and department screens use these.
3. **Original components** (`components/*.tsx` top level, e.g. `MotexaVisual`, `EditorialUI`, `BrandSurfaces`) and
   `components/blueprint/*`: from the first design rounds; some auth / super-admin screens still use them.

Garage tokens (`theme/garage.ts`):
- Colours as named roles (`page`, `card`, `ink`, `soft`, `accent`, `onAccent`, `danger`, …), one set for light (`garageLight`) and one
  for dark (`garageDark`). The comment on `soft` says it keeps 4.5:1 contrast on the page; `mobile/tests/dept-contrast.test.mjs`
  checks text on the bronze fill stays readable.
- Type scale `gType` (display 26 → tiny 11), shapes `gShape` (card radius 22, hero 32, pill), spacing on a 4-pt grid `gSpace(n)`.
- `useGarageTheme()` returns the colours plus a `shadow()` helper: soft warm shadows in light mode, a 1-px border instead in dark mode.
- **Mo** (`components/garage/MoClip.tsx`): a short muted video of the mascot (`expo-video`). It plays each time its screen comes into
  focus, rests on its last frame, never loops, and shows a still image when the phone asks for reduced motion.

"No fake data" is a project rule (`AGENTS.md`): the hero's data line is left out until a real number is known, ratings show "New" when
there are none, and there are no invented ETAs or discounts.

## 5. English / Arabic and right-to-left
- `i18n/LanguageContext.tsx` holds the language (`en` / `ar`), saved in SecureStore under `motexa_language`. It also exposes the older
  `translations.ts` object (used by the first auth / admin screens).
- Most screens use `useL()` (`core/hooks/useL.ts`): `t("English", "العربية")` picks a string inline, so both languages are written
  side by side in the same file. `useL()` also gives `row` (`flexDirection: "row-reverse"` in Arabic) and `align`
  (`textAlign: "right"`).
- **RTL is done per component, not globally**: the app never calls `I18nManager.forceRTL` (switching it needs an app restart). Rows,
  text alignment, start / end positions (`useGarageTheme().start/end`), slide direction of screen transitions
  (`app/_layout.tsx`: `slide_from_left` in Arabic) and the tab bar order are mirrored by code.
- Mixed text: `core/constants/bidi.ts` wraps Latin runs ("BMW", "C W203", "2000–2007") in Unicode isolates so an Arabic sentence keeps
  the right order; tested in `mobile/tests/bidi.test.mjs`.
- Arabic digits: `core/constants/numbers.ts` and the backend's `services/numbers.ts` accept Arabic-Indic digits (٠–٩) in number fields.
- Server texts: errors carry an `errorCode` that the app translates; notifications store `"English||Arabic"` and the app shows one half.
- Arabic fonts: Cairo, IBM Plex Sans Arabic and Tajawal are bundled in `assets/fonts/`.

## 6. Light and dark
- `components/Appearance.tsx`: mode `light`, `dark` or `system` (follows the phone), saved in SecureStore as
  `motexa_appearance_mode`. The default before anything is saved is `dark`.
- `useGarageTheme()` and `useTheme()` both read `dark` from it and return the matching token set; components never hard-code colours
  for one mode. Older screens use `useAppearanceStyles()`, which swaps colours of a base style in dark mode.
- Mo clips sit in a cream "spotlight" card in dark mode, because their cream background cannot blend into a dark page.

## 7. Maps, location and 3D on the phone
- **Maps** (`features/shared/maps.tsx`): Leaflet + OpenStreetMap tiles inside a WebView (no Google key, runs in Expo Go). On web,
  `maps.web.tsx` replaces it with a message. Every screen also shows the information as text.
- **Routes** (`features/shared/routing.ts`): the public OSRM server draws a road line; on any failure the map falls back to a
  straight line. It is geometry only, not tracking.
- **Location** (`features/shared/locationService.ts`, `useCurrentLocation.tsx`): only foreground permission is ever requested.
  Watching runs only while an active tow job / delivery screen is open (every ~10 s and 5 m on Android). `app.json` states the same
  in the permission text: "never tracked in the background".
- **3D viewer** (`features/car3d/`): `sceneHtml.ts` is one HTML page with three.js (loaded from the jsDelivr CDN) that runs inside a
  WebView (`Car3DView.tsx`). The app downloads each `.glb` model once from `/api/3d/...`, caches it in the documents folder
  (`car3d.ts`, `expo-file-system`) and passes it to the WebView as base64. The same viewer code runs headless on the server for
  auto-fits and previews, so what the admin approves is exactly what the customer sees. The WebView is mounted only while its screen
  is focused, to free the WebGL memory.
