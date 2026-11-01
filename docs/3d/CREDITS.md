# 3D model credits

Real car models shown in "My car in 3D" (customer app). Each is used under its licence; CC BY requires this credit, which the
viewer also shows ("3D model: <author> (CC BY)").

| Car | Model | Author | Source | Licence | File (served) |
| --- | --- | --- | --- | --- | --- |
| Toyota Corolla 2013–2019 | 2014 Toyota Corolla E180 EU (with interior) | Armored Wave (https://sketchfab.com/armoredwave) | https://sketchfab.com/3d-models/2014-toyota-corolla-e180-eu-with-interior-36f95efb0585464cae43a25a3b3392e8 | CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/) | backend/public/3d/toyota-corolla-2014.glb |

## Changes made to the models

CC BY asks that changes are indicated. Toyota Corolla: interior meshes removed (seats, dashboard, carpet, belts, speakers,
screens, steering wheel, interior trim), textures resized to 1024 px WebP, geometry compressed (EXT_meshopt_compression,
quantised). In the app the body paint is replaced by a metallic paint in the customer's colour.

## How a model is prepared

Originals go in `3d-source/` (repo root, git-ignored, never bundled). Optimise with gltf-transform (dev tool only):

```
npm i @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer sharp   # in a scratch folder
node docs/3d/optimize-corolla.mjs 3d-source/toyota-corolla-2014.glb backend/public/3d/toyota-corolla-2014.glb
```

Then add the car to `mobile/src/features/car3d/models.ts`.
