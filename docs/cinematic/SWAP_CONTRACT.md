# Replace reviewed media — path-only contract

Default remains CODE-DRAWN PLACEHOLDER. No image generation tool or API was called. Do not place keys or private configuration in this folder. No secret/config file was created, so no gitignore changes were necessary.

## User-supplied files
Place your reviewed images under **mobile/assets/cinematic/generated/**:
- EXT_HERO.png
- INT_COCKPIT.png
- INT_DASH_SCREEN.png

They should be 9:16 with matching vehicle style. Record actual tool, prompt, date and AI-generated classification in mobile/assets/cinematic/MANIFEST.md. Do not infer original tool/model if unknown.

## Exact changes (only after visual review)
Edit **mobile/src/components/cinematic/scenes.config.ts**, changing these three `path` values only:

```ts
EXT_HERO: {path: require('../../../assets/cinematic/generated/EXT_HERO.png') as MediaPath},
INT_COCKPIT: {path: require('../../../assets/cinematic/generated/INT_COCKPIT.png') as MediaPath},
INT_DASH_SCREEN: {path: require('../../../assets/cinematic/generated/INT_DASH_SCREEN.png') as MediaPath},
```

Leave EXT_HERO_LOOP.path as `still:EXT_HERO`. It resolves to EXT_HERO and uses the existing slow scale/translation; it never creates or plays video. For WebP/JPEG change the extension in that one path. Metro requires a literal static require, not a dynamically constructed filesystem string.

Changing a path is sufficient to display the new asset; it does NOT prove the windshield or infotainment line up. Current normalized portal coordinates are measured from the labelled drawings. Photographs must either match those compositions, or later receive an approved coordinate-calibration change in this same config. No scene-code rewrite is required for calibration. This distinction prevents a path-only promise being mistaken for an automatic perfect camera match.

The renderer uses expo-image for real image paths and code-native SVG for placeholder paths. Width and height remain fixed; portal clipping never stretches image aspect ratio. A REVIEW ASSET label remains until future approved polish. No replacement happens merely because files exist.

## Phase 1 entry
Development server: `cd mobile` then `node node_modules/expo/bin/cli start --web --port 58134 --localhost` (or normal Expo start for Android).
Dev-only route: `/cinematic-lab`. No Home/auth route links were added. `enabledInMainFlow` stays false. Release route redirects to existing `/customer` instead of showing the lab.

Hold entry 800ms; release early cancels. Drag upward to advance, downward to reverse; touch cancels momentum. Snap defaults OFF; optional snap acts only after release. Alternative scroll host is selectable in lab. Reduced-motion uses Previous/Next still controls. Skip always uses existing authenticated customer entry. No new endpoints or mock provider actions are introduced.
