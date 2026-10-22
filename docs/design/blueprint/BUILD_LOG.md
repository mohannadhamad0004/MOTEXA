# Blueprint redesign — running log (branch ui/blueprint)

- Setup: branch ui/blueprint, tag backup/before-blueprint-2026-10-20. Design files in docs/design/blueprint are named *_1.* (read as-is).
- RTL in this app is per-component (row-reverse + textAlign), NOT I18nManager. All new components use useTheme().row / isArabic, not start/end.
- Phase 1 (tokens): palette replaced; legacy token names kept as aliases (bg=page, surface=field, border=line, text=ink, accent=bronze, accentFill=btn...). tsc 0.
- Phase 2 (components): src/components/blueprint/* (drawings, Icon, motion, Primitives, Surface, Thumb, Chrome, Page). ui kit Button/Input/SearchBar/Badge/SectionHeader/StatusTimeline/KV restyled in place. tsc 0.
- Phase 3 (customer screens): Home, Parts(+category, shop, categories), Product, Inquiry new/thread, Tow(+company, request form, status), My requests, Mechanics(+profile, request form, status), Profile rebuilt on BlueprintPage/SimplePage. tsc 0.
- Phase 4: DashboardLayout rebuilt as compact blueprint hero (150) + dense sheet + settings sheet; 19 provider/admin/mechanic screens moved onto it via codemod; StatTiles on fleet + inventory; status badges use success/warning/danger/neutral only. tsc 0.
- Verified in browser (react-native-web) with a temporary preview route (deleted): dark/light, EN/AR mirroring, drawings. Found + fixed: svg stacking under absolute layers on web (View wrappers), duplicate identifier in mechanicrequest/[id].tsx.
