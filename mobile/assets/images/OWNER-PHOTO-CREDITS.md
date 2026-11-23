# Car Owner photography

## Original Corolla photograph
- Photographer: EurovisionNim.
- Source: https://commons.wikimedia.org/wiki/File:2018_Toyota_Corolla_(ZRE172R)_Ascent_sedan_(2018-08-27).jpg
- License: Creative Commons Attribution-ShareAlike 4.0 International: https://creativecommons.org/licenses/by-sa/4.0/
- Runtime asset: owner-corolla-2018.webp. Original photograph resized/re-encoded; the app applies a vector clipping path for the car presentation. The photograph and its clipped presentation remain CC BY-SA 4.0. This does not change the license of unrelated application code.
- Narrow match: Toyota Corolla, model year 2018 only. This is a catalog reference for the model, not a photograph of the customer's individual car. Other models use the labeled placeholder.
- No vehicle pixels were generated or repainted. The rejected logo-free generated sedan has no runtime references.

## New service photography
- owner-workshop-podrez.jpg — Artem Podrez: https://www.pexels.com/photo/a-mechanic-fixing-a-car-engine-8985456/
- owner-mobile-meshkov.jpg — Sergey Meshkov: https://www.pexels.com/photo/a-man-working-on-a-car-8478254/
- owner-diagnostics.jpg — https://www.pexels.com/photo/mechanic-working-with-car-engine-13065692/
- owner-interior.jpg — https://www.pexels.com/photo/a-clean-car-interior-5288711/
- Pexels license: https://www.pexels.com/license/. Used as editorial service imagery, never as a mechanic's portrait, workshop photograph, customer upload, or endorsement.

## Motion footage
- Existing exterior driving film is preserved; see ../videos/CREDITS.md.
- motexa-interior-driving.mp4 — ArtHouse Studio: https://www.pexels.com/video/close-up-video-of-a-steering-wheel-4565727/. Pexels license. Silent 10-second optimized excerpt; poster extracted from the same film. Not shown as the customer's actual vehicle.


## New MOTEXA studio illustrations — 16 November 2026

`owner-studio-m8-v2.png`, `owner-studio-corolla-v2.png`, and `owner-studio-interior-v1.png` were created with the built-in image_gen tool. They are AI-generated editorial/model illustrations, not photographs of a customer's actual vehicle or a mechanic's premises. Manufacturer marks remain visible; plate digits are fictional illustration content and are never written to customer vehicle data. Final generation/edit prompts are recorded in `mobile/docs/owner-asset-prompts.json`. Prior v1 drafts remain versioned source assets and are not substituted for the final v2 vehicle cutouts.


## Contextual automotive illustrations — refinement v3

owner-workshop-v3.png, owner-diagnostics-v3.png, owner-wheel-v3.png and owner-interior-v3.png were generated with the built-in image_gen tool. They are editorial illustrations, not actual customer vehicles or provider premises. Exact prompts are recorded in mobile/docs/owner-refinement-assets.json.


## Owner refinement v5 — studio vehicle and cabin illustrations

owner-porsche-front-v5.png / owner-porsche-rear-v5.png, owner-brand-{mercedes,hyundai,kia,volkswagen}-v5.png and owner-cabin-{toyota,bmw,mercedes,hyundai,kia,volkswagen}-v5.png are AI-generated editorial illustrations created with image_gen. They are not a customer's actual car or verified factory configuration. Example model labels are explicitly marked in the studio selector; actual saved make/model/year/fuel and a private user upload take precedence in the garage/Home. Prompts and original output paths are recorded in mobile/docs/owner-ui-v5-assets.json. Plate digits are fictional illustration content and are not saved as customer vehicle registration data. User uploads are authenticated, re-encoded and stripped of EXIF by the backend; they are not part of these static studio assets.

## Owner reference photography — v10/v11

- `owner-audi-reference-v10.jpg` and derivative `owner-audi-photo-cutout-v11.png`: Tyler Clemmensen, [Audi RS7 photograph](https://unsplash.com/photos/4gSavS9pe1s), Unsplash license. Cutout background removed with built-in image_gen, resized using Sharp. Reference model photo, not a customer upload or exact year/trim guarantee.
- `owner-range-reference-v10.jpg` and derivative `owner-range-photo-cutout-v11.png`: Calreyn88, [2023 Range Rover Sport](https://commons.wikimedia.org/wiki/File:2023_Range_Rover_Sport_1.jpg), CC BY-SA 4.0. Changes: background removal with built-in image_gen, resize/re-encoding. This derivative is shared under CC BY-SA 4.0; original attribution retained.
- Toyota Corolla: EurovisionNim, [2018 Toyota Corolla](https://commons.wikimedia.org/wiki/File:2018_Toyota_Corolla_(ZRE172R)_Ascent_sedan_(2018-08-27).jpg), CC BY-SA 4.0. Existing photo displayed through a native SVG clipping path; no generated replacement vehicle.
- `owner-service-mechanic-v10.jpg`: Sergey Meshkov, [mechanic repairing a car](https://www.pexels.com/photo/a-man-working-on-a-car-8478254/), Pexels license; resized/re-encoded existing project photo.
- `owner-service-parts-v10.jpg`: Lucas Liang, [car brake](https://unsplash.com/photos/a-close-up-of-a-brake-on-a-car-X-SnAdB8Ues), Unsplash license; resized/re-encoded existing project photo.
- `owner-service-towing-v10.jpg`: Zoshua Colah, [tow truck](https://unsplash.com/photos/a-white-tow-truck-is-parked-on-the-street-5NpfO5BMJnY), Unsplash license; resized/re-encoded existing project photo.
- `owner-service-ai-v10.jpg`: user-approved generated diagnostic-tablet image, assigned to AI assistant only. Editorial illustration, not an actual mechanic or AI diagnostic result.

Exact photo-cutout prompts are recorded in `mobile/docs/owner-photo-cutout-prompts-v11.json`. Original AI model/cabin illustration credits remain above. These assets do not create or modify any production vehicle record.


## Mechanic service modes — 18 November 2026

New editorial photographs, not provider identities, endorsements, or actual participating workshop photos. Downloaded at 1600 px width from Pexels; natural colors retained, display-only cover crop. Existing assets remain untouched.

- `owner-mode-workshop-park.jpg` — Jae Park, [Mechanics at a Car Garage](https://www.pexels.com/photo/mechanics-at-a-car-garage-15489247/). Workshop equipment and repair work. Runtime: WORKSHOP mode only.
- `owner-mode-onsite-piacquadio.jpg` — Andrea Piacquadio, [Mechanic fixing a car wheel on the street](https://www.pexels.com/photo/adult-bearded-mechanic-fixing-car-wheel-on-street-3855765/). Runtime: ON_SITE mode only.
- `owner-mode-online-call-fring.jpg` — Gustavo Fring, [Mechanic having a conversation over the phone](https://www.pexels.com/photo/smiling-man-in-blue-coveralls-standing-beside-an-orange-car-having-conversation-over-the-phone-6870324/). Runtime: ONLINE mode only. Editorial illustration of remote advice, not a claim of an in-app voice/video call feature.
- `owner-mode-online-piacquadio.jpg` — Andrea Piacquadio, [Worker using a tablet in a workshop](https://www.pexels.com/photo/positive-adult-male-worker-using-tablet-in-workshop-3856116/). Reviewed alternative, not referenced at runtime.
- License verified: [Pexels License](https://www.pexels.com/license/). All four source pages identify the photographs as free to use. These are photographic assets, not AI-generated imagery.


## Service-specific selection — 18 November 2026

These are editorial photographic scenes illustrating service modes, not actual MOTEXA providers or premises. Only image paths and owner-facing service copy changed; no call/video-call feature is implied or added.

- WORKSHOP: `owner-mode-workshop-fring-candidate.jpg` — Gustavo Fring, [Mechanic Checking the Engine of a Car](https://www.pexels.com/photo/mechanic-checking-the-engine-of-a-car-6870313/). Pexels License; downloaded at 1600 px width. Real garage, mechanic and engine visible together.
- ON_SITE: `owner-mode-onsite-reynaga-candidate.jpg` — Jonathan Reynaga, [Man Fixing a Car](https://www.pexels.com/photo/man-fixing-a-car-17429096/). Pexels License; downloaded at 1600 px width. Actual outdoor vehicle repair; cover-cropped only at display time.
- ONLINE: `owner-mode-online-call-poster.jpg` — Gustavo Fring, photographic poster frame of [A Mechanic on a Phone Call Holding a Folder](https://www.pexels.com/video/a-mechanic-on-a-phone-call-holding-a-folder-6870345/). Pexels License; official poster at images.pexels.com/videos/6870345/pexels-photo-6870345.jpeg, downloaded at 1600 px width. A still, not an autoplay video or fake in-app call interface.
- Source license: https://www.pexels.com/license/. No AI generation or image reconstruction used for these assets. Prior candidates remain archived, with no runtime references unless explicitly listed above.


## Current mechanic-mode photography — 18 November 2026

Current runtime selection supersedes earlier candidate selections above. Photography is decorative service imagery, not an identity, endorsement, or photograph of a participating MOTEXA provider. The interface preserves original colors and applies display-only cover crops. No AI image generation or retouching was performed.

- `owner-workshop-engine-fring-6870298.jpg`: Gustavo Fring, [Mechanic Checking the Engine of a Car](https://www.pexels.com/photo/mechanic-checking-the-engine-of-a-car-6870298/). WORKSHOP: a mechanic examining a vehicle inside a garage. Source image 5760×3840; downloaded at 1600 px width.
- `owner-mobile-jumpstart-daniel-5572270.jpg`: Daniel / bestjumpstarterreview.com, [Close-up of Man Repairing Car](https://www.pexels.com/photo/close-up-of-man-repairing-car-5572270/). ON_SITE: outdoor assistance with battery leads beside the vehicle. Source 4317×2878; downloaded at 1600 px width.
- `owner-online-phone-podrez-8986142.jpg`: Artem Podrez, [Mechanic Using a Phone](https://www.pexels.com/photo/woman-in-blue-coverall-using-a-phone-8986142/). ONLINE: a mechanic using a smartphone in a workshop. Source 4160×6240; downloaded at 1600 px width. Display focal position: 50% horizontally, 10% vertically, keeping face and device visible. This illustrates remote consultation, without implying a shipped voice/video-call function.
- Each source identifies the photo as free under the [Pexels License](https://www.pexels.com/license/), checked 18 November 2026. Earlier candidates are inactive.
