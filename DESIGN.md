# MOTEXA Web Design System

## Design Direction

MOTEXA PRECISION WORKSHOP

MOTEXA should feel like:

- a modern automotive service platform
- professional operations software
- technical diagnostic equipment
- an automotive marketplace
- a trustworthy service network

It should not feel like:

- a generic SaaS dashboard
- a Bootstrap admin template
- a collection of cards
- a racing website
- a gaming interface
- a crypto dashboard
- a glassmorphism demo

## Theme

Keep the existing MOTEXA identity:

- espresso / warm brown palette
- existing copper accent
- Cairo font
- existing dark mode
- existing light mode
- existing MOTEXA branding and logo

Do not replace the theme.

The redesign changes the visual language and page composition, not the brand.

## Core Visual Language

Use:

- large typography
- architectural grids
- asymmetric compositions
- hairline separators
- intentional whitespace
- restrained copper
- wide desktop workspaces
- technical/editorial hierarchy
- minimal generic cards
- minimal decorative shadows
- minimal pill UI
- few surface levels

Do not default to rounded cards for normal page structure.

## Cards

Cards are appropriate for real independent objects such as:

- products
- mechanics
- tow companies
- vehicles
- meaningful result objects

Do not automatically use cards for:

- page headers
- profile sections
- filters
- tables
- forms
- settings sections
- ordinary metadata
- admin statistics

Prefer:

- typography
- spacing
- separators
- grid
- surface changes
- aligned key/value sections

## Layout

Use a 12-column responsive layout system where useful.

Possible compositions:

- 8 / 4 main content + context rail
- 7 / 5 workbench + guidance
- 5 / 7 results + map
- 9 / 3 operational list + inspector

Desktop pages should use available width intentionally.

Avoid narrow centered content inside large desktop viewports unless the task
requires focused reading.

## Typography

Use Cairo throughout the web UI.

Suggested hierarchy:

- Hero: 52–64px
- Major public page title: 38–48px
- Admin/workspace title: 30–36px
- Section heading: 21–26px
- Object title: 16–20px
- Body: 14–16px
- Metadata: 12–14px

Use typography to create structure instead of boxes.

## Copper Usage

Keep the current copper accent.

Use it selectively for:

- primary CTA
- active navigation
- active tab indicator
- selected row
- focus state
- important interaction cues
- active workflow step

Do not use copper decoratively everywhere.

## Borders

Prefer subtle 1px hairline separators.

Use horizontal separators more often than full boxed borders.

Avoid vertical table grid lines where possible.

## Radius

Use restrained radius:

- controls: 6–8px
- object cards: 8–10px
- drawers/dialogs: 12px
- pills only where logically appropriate

Avoid excessive rounding.

## Shadows

Use shadows mainly for floating UI:

- dropdowns
- menus
- drawers
- dialogs
- popovers

Static page content should rely on:

- spacing
- surface tone
- typography
- borders

rather than shadow.

## Motion

Use restrained transitions around 150–220ms.

Good uses:

- hover state
- background change
- underline motion
- drawer slide
- menu appearance
- selected-state transition

Avoid:

- bouncing
- dramatic scaling
- decorative animation

## Responsive Design

Do not simply stack desktop layouts vertically.

Recompose layouts for smaller screens.

Check approximately:

- 1440px
- 1280px
- 1024px
- 768px
- 390px

Desktop:
- wide layouts
- data-heavy pages may use broad workspaces

Tablet:
- collapse secondary columns intelligently
- keep important information visible

Mobile:
- prioritize primary identity and action
- compact rows
- avoid excessively tall stacked cards
- use full-screen map/list modes where appropriate
- secondary information may move to drawer/detail views

## Page Families

### Public Discovery

Pages:

- Home
- Marketplace
- public shop pages

Style:

- strong editorial hierarchy
- larger imagery
- discovery-first layout
- product grids
- fewer generic cards

### Explorer

Pages:

- Mechanics
- Tow companies
- map-based discovery

Style:

- results rail
- large map workspace
- selected-result state
- inspector panel where useful
- mobile list/map switching

### Workbench

Pages:

- AI Diagnosis

Style:

- workflow steps
- focused evidence area
- main working surface
- contextual guidance rail
- strong task progression

### Technical Document

Pages:

- Diagnosis results
- Reports

Style:

- report/document hierarchy
- metadata
- numbered sections
- horizontal rules
- action rail where useful

### Operations

Pages:

- Admin
- Mechanic dashboard
- Parts Shop dashboard
- Tow dashboard

Style:

- wide workspaces
- flat operational lists
- minimal cards
- inspector drawers
- technical navigation
- strong information density without cramped layouts

### Personal

Pages:

- Profile
- Account
- My Cars

Style:

- dossier layout
- aligned key/value information
- horizontal separators
- vehicle objects may use cards

### Communication

Pages:

- Chats

Style:

- conversation list
- active conversation workspace
- request/provider context where useful

## Home

Use a bold asymmetric hero.

Desktop:

Left:
- large headline
- concise supporting text
- primary CTA
- secondary action
- trust indicators

Right:
- product UI / diagnostic preview

Do not use generic stock-car imagery as the main hero concept.

Use the product itself as the visual identity.

Below hero:

- service index
- connected "How MOTEXA works" flow
- provider/trust area
- marketplace preview
- emergency section

Avoid three identical feature cards.

## Marketplace

Use a real automotive catalog composition.

Prioritize:

- search
- selected vehicle / My Garage
- category navigation
- compatibility context
- product grid

Product cards are appropriate.

Product cards should prioritize:

- image
- part name
- brand
- compatibility
- price
- save action

Do not overload cards with metadata.

## Mechanics / Tow

Use explorer-style layouts.

Desktop target:

- results rail
- large map workspace

Map should not be trapped inside a small card.

On mobile:

- List mode
- Map mode

Do not show a tiny map and tiny list at the same time.

## AI Diagnosis

Use a diagnostic workbench.

Possible structure:

- step index
- main working area
- context rail

Possible steps based on current flow:

- Evidence
- Vehicle
- Problem details
- Review / Analysis

Do not present the whole page as one generic form card.

## Diagnosis Results

Use a technical report layout.

Prioritize:

- vehicle
- urgency
- observations
- possible causes
- evidence strength
- recommended checks
- recommended specialist
- existing actions

Use:

- Strong
- Moderate
- Weak

Do not invent confidence percentages.

## Admin

Use a precision operations console.

Sidebar:
- flat
- architectural
- existing grouping
- active copper indicator
- minimal pill styling

Main content:
- wide
- flat lists
- hairlines
- inspector drawers
- restrained status indicators

Do not put every admin table inside a large rounded card.

## Admin Overview

Prioritize actionable work first.

Suggested structure:

- Needs attention
- Platform snapshot
- Recent activity

Avoid large grids of stat cards.

## Admin Users

Use a people-directory composition.

Anchor each row with:

- avatar/photo/initials
- name
- email
- role
- status
- joined metadata
- actions

Avoid large role/status pills.

## Admin Listings

Use a marketplace-moderation feed.

Anchor each row with:

- part thumbnail
- part name
- part number/brand/category
- shop
- status
- price
- actions

Admin must not gain edit access to shop-owned part data.

## Admin Reviews

Use an editorial moderation feed, not a traditional small-text table.

Prioritize:

- rating
- review text
- reviewer
- provider
- request
- date
- report/visibility state
- actions

Reported reviews should surface report information calmly.

Do not tint the entire item bright red.

## Admin Approvals

Use document-review composition.

Main area:
- applicant identity
- submitted information
- documents
- skills/photos where applicable

Context rail:
- approval state
- verification method
- admin notes
- approve/reject actions

Do not change approval logic.

## Profile / Account

Use dossier-style sections.

Example:

PERSONAL INFORMATION
------------------------------------------------

Name
Phone
City

ACCOUNT
------------------------------------------------

Email

SECURITY
------------------------------------------------

Password
Change password

Avoid stacked section cards.

## Authentication

Desktop:
- split composition

Left:
- MOTEXA identity
- trust/value context

Right:
- focused auth form

Avoid a tiny centered login card inside a huge empty screen.

Mobile:
- single-column focused form

## Chats

Desktop:
- conversation list
- active conversation
- optional request/provider context

Avoid unnecessary nested cards.

## Reports

Use document-style presentation.

Prioritize:

- strong report header
- request/vehicle/provider metadata
- clear sections
- print-friendly spacing
- horizontal rules

Avoid card grids.

## Accessibility

Maintain:

- WCAG AA contrast
- visible focus
- semantic controls
- status text in addition to color
- usable touch targets
- Escape behavior
- focus restoration
- keyboard navigation

## Final Principle

Preserve function.

Do not preserve weak presentation.

A successful redesign should feel like:

"the same MOTEXA product, professionally redesigned"

not:

"the old MOTEXA with slightly better spacing."