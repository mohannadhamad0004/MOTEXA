---
name: MOTEXA
description: Warm cream, espresso ink and a single copper accent; flat hairline-ruled lists for a calm, trustworthy car-care marketplace.
colors:
  copper-text: "#a65a2e"
  copper-text-hover: "#8a4623"
  copper-soft: "#fbefe4"
  copper-button: "#cf8a57"
  copper-button-light: "#e3ae80"
  copper-button-deep: "#b96f40"
  copper-dark-mode: "#d08a55"
  copper-on-button-ink: "#1a1210"
  cream-page: "#faf5ef"
  paper-surface: "#ffffff"
  sand-subtle: "#f1e7dc"
  hairline: "#e5d8ca"
  hairline-strong: "#8c7767"
  espresso-ink: "#2a1d16"
  espresso-muted: "#6f5b4e"
  espresso-page-dark: "#1a1210"
  espresso-surface-dark: "#241a16"
  espresso-subtle-dark: "#2a1f1a"
  espresso-raised-dark: "#30251e"
  hairline-dark: "#3d2f27"
  cream-ink-dark: "#f5ebe0"
  cream-muted-dark: "#b8a596"
  success: "#146c3a"
  success-bg: "#ddf3e4"
  warning: "#7a5200"
  warning-bg: "#fbefc8"
  danger: "#b42318"
  danger-bg: "#fbe4e1"
  info: "#2f5fa8"
  info-bg: "#e1ebf8"
typography:
  display:
    fontFamily: "Cairo, system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans Arabic', sans-serif"
    fontSize: "clamp(2.5rem, 1.1rem + 5.6vw, 5.5rem)"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Cairo, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 1.6rem + 0.9vw, 2.125rem)"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Cairo, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Cairo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Cairo, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.12em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
  "7": "48px"
  "8": "64px"
  "9": "96px"
components:
  button-primary:
    backgroundColor: "{colors.copper-button}"
    textColor: "{colors.copper-on-button-ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.copper-text}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.copper-text}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.espresso-ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "44px"
  card:
    backgroundColor: "{colors.paper-surface}"
    rounded: "{rounded.lg}"
    padding: "24px"
  action-menu:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.espresso-ink}"
    rounded: "{rounded.md}"
    padding: "4px"
---

# Design System: MOTEXA

## Overview

**Creative North Star: "The Workshop Ledger"**

MOTEXA looks like a well-kept mechanic's job book: warm cream pages, espresso ink, and one copper accent used the way a mechanic uses a red pencil. It is a calm, trustworthy, warm system. Work happens on flat, hairline-ruled lists and quiet pages, not in stacks of boxes. Copper is rare enough that it always means "this is the thing to do" or "you are here".

The system serves two moods from one palette. Public pages (home, marketplace, directories) are editorial and image-led: bold display type, wide asymmetric compositions on hairlines, photo-led product and provider cards, and no soft gradient hero band. Operate pages (admin, dashboards, requests) are denser and flatter: rows separated by hairlines, a quiet header, a ••• menu for secondary actions, status shown as a dot plus a word. Both stay warm; neither drifts into cold greys or glossy gradients.

Dark mode is deep espresso brown, never black. Depth comes from lighter surfaces layered on top, with only faint shadows. Every text/background pair passes WCAG AA in both themes.

**Key Characteristics:**
- Warm neutrals only: cream, sand, espresso; copper is the single accent.
- Flat by default; hairlines (1px) do the separating work.
- Status is a colored dot plus a word, never color alone.
- Cairo throughout (Latin and Arabic with no font change); extra-bold headlines, bold labels.
- 4px spacing grid, 44px touch targets, mobile-first (checked at 375, 768 and 1280).

## Colors

A warm cream-and-espresso palette with copper as the only accent; green, amber, red and muted blue exist for status alone.

### Primary
- **Copper Ink** (#a65a2e light, #d08a55 dark): links, icons, selected states, eyebrows, the focus ring, secondary and ghost button text. 4.7:1 on cream.
- **Copper Button** (gradient #e3ae80 to #b96f40, solid #cf8a57): the primary-action button only, with dark brown text (#1a1210). White on light copper fails AA.
- **Copper Wash** (#fbefe4 light, #33241c dark): selected and hovered backgrounds, text selection.

### Neutral
- **Cream Page** (#faf5ef) / **Espresso Page** (#1a1210): the page background.
- **Paper** (#ffffff) / **Espresso Surface** (#241a16): inputs, cards, panels.
- **Sand** (#f1e7dc) / **Espresso Subtle** (#2a1f1a): hovered rows, skeletons, wells.
- **Hairline** (#e5d8ca / #3d2f27): row and section dividers. **Strong Hairline** (#8c7767 / #85705f): input borders, 3:1 against surfaces.
- **Espresso Ink** (#2a1d16) / **Cream Ink** (#f5ebe0): text. **Muted Espresso** (#6f5b4e / #b8a596): secondary text, never below 13px.

### Status (indicators only)
- **Success** (#146c3a), **Warning** (#7a5200), **Danger** (#b42318), **Info** (#2f5fa8), each with a pale background tint; lighter variants in dark mode.

### Named Rules
**The Red-Pencil Rule.** Copper marks the one main action or the current place on a screen. If two things on a screen are copper-filled, one of them is wrong.

**The Status-Only Colors Rule.** Green, amber, red and blue are allowed for status indicators and nothing else. They never decorate headings, surfaces or buttons (danger buttons excepted).

**The Warm Neutral Rule.** No pure black, no cool grey. Every neutral leans toward brown.

## Typography

**Display / Body / Label Font:** Cairo (with system-ui, Segoe UI, Roboto, Noto Sans Arabic)
**Mono:** ui-monospace, Cascadia Mono, Consolas (IDs, part numbers)

**Character:** One humanist sans that covers Latin and Arabic, so the same hierarchy works in both scripts. Weight, not family changes, carry hierarchy: extra-bold for page titles, bold for names and labels, regular for reading.

### Hierarchy
- **Display** (800, clamp 2.5-5.5rem, 1.04, -0.035em, `text-wrap: balance`): the headline of a major public landing page (home, marketplace). Bold editorial type is the main structural device on those pages. Operate pages never use it.
- **Headline** (800, clamp 1.875-2.125rem, 1.2, -0.015em): page titles (PageIntro).
- **Title** (700, 1.125-1.5rem, 1.2-1.3): row names, card titles, section headings.
- **Body** (400, 1rem, 1.6): reading text; descriptions capped near 72ch.
- **Label** (700, 0.8125rem, 0.12em, uppercase): eyebrows, table headers, section kickers. Copper for eyebrows, muted espresso for headers.

### Named Rules
**The No-Tiny-Grey Rule.** Muted text is 13px (`--font-size-xs`) at the smallest and must keep AA contrast. Never shrink and fade text together.

**The Editorial Display Rule.** Large display type is for the one headline that names a public landing page, and is paired with a small copper kicker above it. Section titles below it step down to headline or title size. Never set body, row or menu text in display size.

**The Tabular Money Rule.** Prices (ILS, ₪) and counts use tabular numerals so columns line up.

## Layout

Mobile-first, 4px spacing steps (`--space-1` 4px to `--space-9` 96px). Page content caps at 1280px; home, the directory and the marketplace use 1560px (public pages may use it whenever the composition benefits, as long as text lines stay readable and the layout recomposes at tablet and phone widths: 12-column grids such as 7/5 heroes and 3/9 label rails collapse to one column below 1024px); admin uses 1780px so the sidebar plus roughly 1440px of content fit. Pages sit inside a shared Layout (navbar plus outlet); admin adds a left sidebar that becomes a horizontal scrolling tab strip on phones.

Operate lists (`FlatDataList`) measure their own width, not the viewport: at 900px and wider they are a header plus grid rows with named columns; below that the first cell becomes the row title with the ••• menu beside it and the remaining cells flow two per line beneath, labelled. Optional columns hide below 1040px. Rows are at least 72px tall with 16px padding and a hairline below. Page headers (`PageIntro`) are a 12-column grid: eyebrow, extra-bold title, muted description, hairline underneath.

Check every layout at 375, 768 and 1280px, and at 390px for phone rows.

## Elevation & Depth

Flat at rest. Surfaces are separated by hairlines and tonal steps (page, surface, subtle, raised), not by shadows. Light mode uses soft warm-brown shadows only when something floats; dark mode relies on lighter surfaces with faint black shadows.

### Shadow Vocabulary
- **Card** (`--shadow-sm`: 0 1px 2px rgba(74,44,24,.07), 0 1px 3px rgba(74,44,24,.09)): marketplace and directory cards.
- **Menu** (`--shadow-md`: 0 4px 8px -2px rgba(74,44,24,.1)): hover lift on interactive cards.
- **Floating** (`--shadow-lg`: 0 16px 32px -8px rgba(74,44,24,.2)): ••• menus, modals, drawers, toasts.
- **Copper Glow** (`--shadow-glow`: 0 6px 16px -4px rgba(185,111,64,.5)): under the primary button only.
- **Focus Ring** (`0 0 0 3px surface, 0 0 0 5px copper`): every keyboard-focused control.

### Named Rules
**The Flat-By-Default Rule.** A surface gets a shadow only when it floats above the page (menu, modal, drawer) or responds to hover. Lists and settings sections never have one.

## Shapes

Gently rounded. 8px (`--radius-md`) is the workhorse for buttons, inputs and menus; 6px for items inside menus and small hit areas; 12px for cards; 16px for large containers; pills (999px) only for tags and counts. Avatars are circles. Photos are 4:3 on a light neutral (#f4eee8) with `object-fit: contain`, so white-background product shots look identical in both themes. List rows are square-cornered, divided by hairlines, with no outer box.

## Components

### Buttons
- **Shape:** 8px radius (large: 12px); 44px tall (small: 32px); bold 14px label.
- **Primary:** copper gradient with dark brown text and a soft copper glow. One per view.
- **Secondary:** paper fill, copper text, strong-hairline border; fills with copper wash on hover.
- **Ghost:** transparent, copper text, copper wash on hover.
- **Danger:** solid danger red with contrast text; dims slightly on hover.
- **Focus / disabled / loading:** focus ring replaces the shadow; disabled at 55% opacity; loading swaps in a spinner.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** paper surface with a 1px hairline border; elevated variant uses the raised surface and the floating shadow.
- **Flat variant:** no box, just a strong-hairline rule on top and 24px padding; used for sections on settings and profile pages.
- **Interactive:** hover lifts 2px and turns the border copper.

### Inputs / Fields
- **Style:** 44px tall, paper fill, 1px strong-hairline border, 8px radius.
- **Focus:** copper border plus a soft copper glow (30% ring, 35% halo).
- **Error / Disabled:** danger border and a danger focus ring; disabled uses the subtle surface and muted text.
- **Filters:** the filter toolbar uses borderless, bold text selects with a hairline underline on hover, not boxed dropdowns.

### Flat Data List (signature)
A header of small-caps muted labels over a strong hairline, then one grid row per record with hairlines between and no vertical lines. Primary value first (a thumbnail or avatar as the anchor, then the name in bold, then quiet metadata beneath). Row hover shifts to the sand tone; the selected row gets a 2px copper edge. Rows open a detail drawer when clicked; links, buttons and the menu don't trigger it.

### Action Menu
A 44px ••• button that opens a floating menu of 44px items. Secondary actions live here; destructive items are red text, separated by a hairline above. Neutral state-reversals such as Reactivate or Unhide are plain text, not red.

### Status Indicator
An 8px dot plus the status word in semibold 14px ink. The dot carries the color (success, warning, danger, info, neutral); the word carries the meaning. Two statuses sit side by side on one line when space allows.

### Navigation
- **Navbar:** 64px, cream with a hairline, brand mark left, text links, a red Emergency button, theme toggle, notifications and the account menu right.
- **Admin sidebar:** grouped sections with small-caps labels; the active item gets a copper left edge and a sand fill; counts in copper. On phones it becomes a horizontally scrolling tab strip.

### Drawer and Modal
A detail drawer slides from the right on the raised surface with a floating shadow and a close button; Modal is centered with the same surface. Both sit on a dark brown overlay.

## Do's and Don'ts

### Do:
- **Do** build lists as flat hairline rows with a primary value, quiet metadata and a ••• menu for secondary actions.
- **Do** use tokens (`var(--color-*)`, `--space-*`, `--radius-*`); never raw colors or pixel sizes.
- **Do** put dark brown (#1a1210) text on copper; white on copper fails AA.
- **Do** pair every status color with a word.
- **Do** keep muted text at 13px or larger with AA contrast, in both themes.
- **Do** keep one primary button per view and let copper stay rare.
- **Do** check light and dark mode at 375/390, 768 and 1280px.

### Don't:
- **Don't** nest cards or put every section in a box; use hairlines and whitespace (the flat variant) instead.
- **Don't** use purple or blue gradient backgrounds.
- **Don't** use tiny grey text; muted does not mean small and faint.
- **Don't** use marketplace-style product cards on admin pages.
- **Don't** use status colors (green, amber, red, muted blue) for anything but status indicators.
- **Don't** use pure black or cool grey; dark mode is espresso brown.
- **Don't** add shadows to resting surfaces, or glow to anything except the primary button.
