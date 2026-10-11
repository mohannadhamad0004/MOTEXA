# mechanics

Public directory of approved mechanics. Anyone can browse it without logging in.

| Path | Purpose |
| --- | --- |
| `pages/MechanicsDirectory.jsx` | `/mechanics` - hero search (problem or skill / city / my location, with symptom matching), AI banner, skill tiles with photos, rows (specialists for your car, top rated, near you, mobile, 24/7), results as cards + map with filters (skill, service, car make) and sort, then how it works, mechanics by city, why MOTEXA. In the URL: `?q=brakes&city=Nablus&skill=Electrical&mode=on_site&make=Toyota&sort=rating` (the AI diagnosis links here with its suggested skill; any capitalization works) |
| `symptoms.js` | Symptom words -> skill ("squeaking brakes" -> Brakes). Edit this list to teach the search new symptoms |
| `mechanicsSearch.js` | `findMechanics` (search, city, filters, sort, distance), `mechanicsByCity`, `skillCounts`, `allMakes` - pure functions |
| `skills.js`, `images.js`, `mechanicImages.json` | Photo search words for the skill tiles and workshop covers; the downloaded photos (written by `npm run images:fetch`) |
| `components/MechanicMiniCard.jsx`, `MechanicFilters.jsx`, `MechanicSections.jsx` | Row card, filter bar, AI banner and trust section |
| `pages/MechanicProfile.jsx` | `/mechanics/:mechanicId` - photo, workshop, address, description, services (on-site with cities, workshop visit, online consultation), skills with years, "Verified by MOTEXA", workshop photos, "Request service" |
| `components/MechanicCard.jsx` | One mechanic in the results: workshop cover photo, avatar, rating, badges, top skills, View profile / Request service |
| `components/ServiceModeBadges.jsx` | The service modes a mechanic offers, as badges |
| `searchMechanics.js` | Search index over the mechanics (uses `utils/wordSearch.js`, the marketplace's word-level fuzzy approach) |
| `api.js` | Calls to apps/api (not implemented yet) |
| `types.js` | JSDoc types |

**Data:** mechanics are accounts, so for now they come from the mock auth service:
`getDirectory('mechanic')` and `getDirectoryEntry('mechanic', id)` (see `auth/authService.js`).
They return approved mechanics only, with public fields only - no email, phone or certificates.
Certificates are visible to admins only (`/admin/approvals`). `apps/api` must apply the same rules.

Service modes (`SERVICE_MODES` in `auth/signup/constants.js`) are set by the mechanic on `/profile`
("Services I offer") and are not reviewed. New mechanics start with workshop visits only.

The search hero, the results list + map (`ResultsLayout`, `ResultsMap`) and the city / how-it-works
sections are shared with `/tow-companies` and live in `features/logistics/components`. Mechanics have
a workshop location (`base`) and the car makes they specialize in (`makes`, set on `/profile` under
"Services I offer", not reviewed).
