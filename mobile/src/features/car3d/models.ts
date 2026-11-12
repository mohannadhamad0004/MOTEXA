// The real 3D car models we have, and how each one is set up. A car without an entry here shows "3D for <car> is coming soon".
// Each entry is ONE generation (VehicleGeneration.model3dKey = key). Files live in backend/public/3d (optimised from the originals
// in the git-ignored 3d-source/ by backend/scripts/optimize-3d.ts, which also writes the generated block below; credits in
// docs/3d/CREDITS.md) and are downloaded once by the app (car3d.ts). "check" comments = guesses to look at in the viewer.
import type { Car } from "../catalog/myCar";
import type { AccessoryType, AccessoryZone, PartMap } from "./modelConfig";

export type Offset = { x: number; y: number; z: number; scale: number };

export type CarModel = {
  /** = VehicleGeneration.model3dKey; the file is backend/public/3d/<key>.glb, served at /api/3d/<key>.glb */
  key: string;
  /** which generation it shows, for people reading this list (the app maps by key) */
  generation: string;
  /** scaled so the car is this long (metres) */
  lengthM: number;
  /** turn (radians, about Y) that makes the front face +Z */
  rotateY: number;
  /** Source up-axis correction applied in a child group before heading; radians. */
  preRotateX?: number;
  /** extra lift after the wheels are put on the ground (metres) */
  groundOffset: number;
  /** nodes whose meshes are the painted body ([] = the whole car); ONLY meshes with a paintMaterials material get the colour */
  paintNodes: string[];
  /** materials that are paint ([] = the model keeps its own colours) */
  paintMaterials: string[];
  /** true: the wheels are separate meshes (a rim choice is possible); false: one combined mesh */
  rimsSwappable: boolean;
  /** photo-baked paint (the paint is part of one texture, no paint material): recolour the texels in this hue window, see sceneHtml */
  bakedPaint?: { hue: [number, number]; sat: number; ref: number };
  /** meshes whose centre is outside this box (model units, after rotateY) are removed: some files carry loose, exploded kit parts around the car */
  /** x (model units, after rotateY) that is the car's symmetry axis, when the bounding box centre is not */
  centerX?: number;
  /** tuned accessory fitting zones (admin-editable, merged in by the server catalog); see sceneHtml KIT for the defaults */
  zones?: Partial<Record<AccessoryType, AccessoryZone>>;
  /** the Parts Admin's confirmed part map for this exact model file (server catalog only); see sceneHtml PART MAP */
  partMap?: PartMap;
  rimProposal?: { ids: string[]; confidence: number };
  keepBox?: { y: [number, number]; z: [number, number]; /** also removed by name (a displaced duplicate headlight set) */ names?: string[] };
  /** per-model nudges for the computed wing / roof-rack anchors (metres, after scaling) */
  wing: Offset;
  rack: Offset;
  credit: { title: string; author: string; url: string; license: string };
};

export const CAR_MODELS: CarModel[] = [
  // Generated from docs/3d/models.json by vehicle3d-catalog.ts.
  {"key":"toyota-corolla-e170-e180","generation":"Toyota Corolla E170/E180","lengthM":4.6,"rotateY":0,"groundOffset":0,"paintNodes":["corolla_e180_body"],"paintMaterials":["main_paint","main_paint.001"],"rimsSwappable":false,"wing":{"x":0,"y":0,"z":0,"scale":1},"rack":{"x":0,"y":0,"z":0,"scale":1},"credit":{"title":"2014 Toyota Corolla E180 EU (with interior)","author":"Armored Wave","url":"https://sketchfab.com/3d-models/2014-toyota-corolla-e180-eu-with-interior-36f95efb0585464cae43a25a3b3392e8","license":"CC BY 4.0"}},
  {"key":"bmw-3-series-e36","generation":"BMW 3 Series E36","lengthM":4.65,"rotateY":0,"groundOffset":0,"paintNodes":[],"paintMaterials":["BMWE36_paint","BMWE36_paint.002","BMWE36_paint.004","BMWE36_paint.001"],"rimsSwappable":true,"wing":{"x":0,"y":0,"z":0,"scale":1},"rack":{"x":0,"y":0,"z":0,"scale":1},"credit":{"title":"BMW 3-Series e36 [Street]","author":"Black Snow","url":"https://sketchfab.com/3d-models/bmw-3-series-e36-street-13d0a12ecda04317b96ce1e618300412","license":"CC BY 4.0"}},
  {"key":"bmw-x5-e53","generation":"BMW X5 E53","lengthM":4.9,"rotateY":0,"groundOffset":0,"paintNodes":[],"paintMaterials":["paint"],"rimsSwappable":true,"wing":{"x":0,"y":0,"z":0,"scale":1},"rack":{"x":0,"y":0,"z":0,"scale":1},"credit":{"title":"BMW X5 E53 RESTYLING | High Quality","author":"takeover","url":"https://sketchfab.com/3d-models/bmw-x5-e53-restyling-high-quality-1dfdb422f05d44b287e332bec4311c50","license":"CC BY 4.0"}},
  {"key":"hyundai-accent-lc","generation":"Hyundai Accent LC","lengthM":4.3,"rotateY":0,"groundOffset":0,"paintNodes":[],"paintMaterials":["Kuzov"],"rimsSwappable":false,"wing":{"x":0,"y":0,"z":0,"scale":1},"rack":{"x":0,"y":0,"z":0,"scale":1},"credit":{"title":"Hyundai Accent (TaGAZ) 2004","author":"panderlaike_design","url":"https://sketchfab.com/3d-models/hyundai-accent-tagaz-2004-b00b5faebc314e54aef423e46230e963","license":"CC BY 4.0"}},
  {"key":"mercedes-c-class-w203","generation":"Mercedes-Benz C-Class W203","lengthM":4.7,"preRotateX":-1.5707963267948966,"rotateY":0,"groundOffset":0,"paintNodes":[],"paintMaterials":["carpaint"],"rimsSwappable":false,"wing":{"x":0,"y":0,"z":0,"scale":1},"rack":{"x":0,"y":0,"z":0,"scale":1},"credit":{"title":"Mercedes- Benz C-class W203 sedan","author":"Nieve5677","url":"https://sketchfab.com/3d-models/mercedes-benz-c-class-w203-sedan-ff9ba755fc884fb88b5e73c3df1296e1","license":"CC BY 4.0"}},
  {"key":"mercedes-e-class-w212","generation":"Mercedes-Benz E-Class W212","lengthM":4.9,"rotateY":3.141592653589793,"groundOffset":0,"paintNodes":[],"paintMaterials":["mat_body"],"rimsSwappable":true,"wing":{"x":0,"y":0,"z":0,"scale":1},"rack":{"x":0,"y":0,"z":0,"scale":1},"credit":{"title":"Mercedes E Class W212","author":"Peter_D","url":"https://sketchfab.com/3d-models/mercedes-e-class-w212-119c5e10733142b197aa53b86f6aeb04","license":"CC BY 4.0"}},
  {"key":"mercedes-vito-w447","generation":"Mercedes-Benz Vito W447","lengthM":5,"rotateY":0,"groundOffset":0,"paintNodes":[],"paintMaterials":["Body"],"rimsSwappable":false,"wing":{"x":0,"y":0,"z":0,"scale":1},"rack":{"x":0,"y":0,"z":0,"scale":1},"credit":{"title":"Mercedes Vito Utility Car","author":"solid3DDD","url":"https://sketchfab.com/3d-models/mercedes-vito-utility-car-fe704a2aa87a4921990d4973a6eef36d","license":"CC BY 4.0"}},
  {"key":"peugeot-208-2nd-gen-p21","generation":"Peugeot 208 2nd gen / P21","lengthM":4.05,"rotateY":0,"groundOffset":0,"paintNodes":[],"paintMaterials":["Carro_Pintura"],"rimsSwappable":false,"wing":{"x":0,"y":0,"z":0,"scale":1},"rack":{"x":0,"y":0,"z":0,"scale":1},"credit":{"title":"2021 Peugeot 208","author":"tonielpro520","url":"https://sketchfab.com/3d-models/2021-peugeot-208-c3a458884cf7434fa99b2172c96061a4","license":"CC BY 4.0"}},
  {"key":"peugeot-308-2nd-gen-t9","generation":"Peugeot 308 2nd gen / T9","lengthM":4.3,"rotateY":0,"groundOffset":0,"paintNodes":[],"paintMaterials":["Carro_Pintura","FrontColor"],"rimsSwappable":false,"wing":{"x":0,"y":0,"z":0,"scale":1},"rack":{"x":0,"y":0,"z":0,"scale":1},"credit":{"title":"2018 Peugeot 308","author":"tonielpro520","url":"https://sketchfab.com/3d-models/2018-peugeot-308-4676332e370b4333b76ddc9910ceae7e","license":"CC BY 4.0"}},
  {"key":"renault-fluence-l38","generation":"Renault Fluence L38","lengthM":4.5,"rotateY":0,"groundOffset":0,"paintNodes":[],"paintMaterials":["carpaint"],"rimsSwappable":false,"wing":{"x":0,"y":0,"z":0,"scale":1},"rack":{"x":0,"y":0,"z":0,"scale":1},"credit":{"title":"Renault Fluence","author":"Nieve5677","url":"https://sketchfab.com/3d-models/renault-fluence-473adbb15922457bb9fa247bc89c4cb9","license":"CC BY 4.0"},"preRotateX":-1.5707963267948966},
  {"key":"skoda-fabia-mk2-5j","generation":"Skoda Fabia Mk2 / 5J","lengthM":4,"rotateY":0,"groundOffset":0,"paintNodes":[],"paintMaterials":["Blue_Car_Paint"],"rimsSwappable":false,"wing":{"x":0,"y":0,"z":0,"scale":1},"rack":{"x":0,"y":0,"z":0,"scale":1},"credit":{"title":"Skoda Fabia Mk.2","author":"barking_dogo","url":"https://sketchfab.com/3d-models/skoda-fabia-mk2-e2e0be2c52994e3bb6cae225f3e7482d","license":"CC BY 4.0"}},
  {"key":"skoda-octavia-mk2-1z","generation":"Skoda Octavia Mk2 / 1Z","lengthM":4.65,"rotateY":0,"groundOffset":0,"paintNodes":[],"paintMaterials":["car_paint"],"rimsSwappable":false,"wing":{"x":0,"y":0,"z":0,"scale":1},"rack":{"x":0,"y":0,"z":0,"scale":1},"credit":{"title":"2005 Skoda Octavia","author":"tonielpro520","url":"https://sketchfab.com/3d-models/2005-skoda-octavia-c31169ccfd354b6c9b6f09964c113ae3","license":"CC BY 4.0"}},
  {"key":"toyota-c-hr-1st-gen","generation":"Toyota C-HR 1st gen","lengthM":4.36,"rotateY":0,"groundOffset":0,"paintNodes":[],"paintMaterials":["Paint_Color"],"rimsSwappable":false,"wing":{"x":0,"y":0,"z":0,"scale":1},"rack":{"x":0,"y":0,"z":0,"scale":1},"credit":{"title":"2022_Toyota_C-HR_3D_model","author":"Xeeter","url":"https://sketchfab.com/3d-models/2022-toyota-c-hr-3d-model-1f66a3fdb7da421cafb089467b5a6140","license":"CC BY 4.0"}},
  {"key":"toyota-camry-xv20","generation":"Toyota Camry XV20","lengthM":4.85,"preRotateX":-1.5707963267948966,"rotateY":0,"groundOffset":0,"paintNodes":[],"paintMaterials":["carpaint"],"rimsSwappable":false,"wing":{"x":0,"y":0,"z":0,"scale":1},"rack":{"x":0,"y":0,"z":0,"scale":1},"credit":{"title":"Toyota Camry (Mk4)(XV20) 1997","author":"Nieve5677","url":"https://sketchfab.com/3d-models/toyota-camry-mk4xv20-1997-196829bf4cbc4b8cb26c50964f35ff27","license":"CC BY 4.0"}},
  {"key":"toyota-camry-xv70","generation":"Toyota Camry XV70","lengthM":4.85,"rotateY":0,"groundOffset":0,"paintNodes":[],"paintMaterials":["Paint_Color"],"rimsSwappable":false,"wing":{"x":0,"y":0,"z":0,"scale":1},"rack":{"x":0,"y":0,"z":0,"scale":1},"credit":{"title":"Toyota Camry 2020","author":"ItsDiyor","url":"https://sketchfab.com/3d-models/toyota-camry-2020-236a5a6e2fa6420fbdf641f4800cd544","license":"CC BY 4.0"}},
  {"key":"toyota-corolla-e210","generation":"Toyota Corolla E210","lengthM":4.6,"rotateY":0,"groundOffset":0,"paintNodes":[],"paintMaterials":["Paint_Color"],"rimsSwappable":false,"wing":{"x":0,"y":0,"z":0,"scale":1},"rack":{"x":0,"y":0,"z":0,"scale":1},"credit":{"title":"Toyota Corolla 2020","author":"ItsDiyor","url":"https://sketchfab.com/3d-models/toyota-corolla-2020-6d7d34ee42734d1ab28a6b1f1c5fc4fc","license":"CC BY 4.0"}},
  {"key":"volkswagen-caddy-sb-latest","generation":"Volkswagen Caddy SB / latest","lengthM":4.4,"rotateY":0,"groundOffset":0,"paintNodes":[],"paintMaterials":["M_2022_Volkswagen_Caddy_Copper_Bronze_Metallic"],"rimsSwappable":false,"wing":{"x":0,"y":0,"z":0,"scale":1},"rack":{"x":0,"y":0,"z":0,"scale":1},"credit":{"title":"2022 Volkswagen Caddy","author":"tonielpro520","url":"https://sketchfab.com/3d-models/2022-volkswagen-caddy-b737cd468d114792aaee9e68480adfbb","license":"CC BY 4.0"}},
  {"key":"volkswagen-polo-mk4-9n","generation":"Volkswagen Polo Mk4 / 9N","lengthM":4,"preRotateX":-1.5707963267948966,"rotateY":0,"groundOffset":0,"paintNodes":[],"paintMaterials":["carpaint"],"rimsSwappable":true,"wing":{"x":0,"y":0,"z":0,"scale":1},"rack":{"x":0,"y":0,"z":0,"scale":1},"credit":{"title":"Volkswagen Polo 3-door MK4 2001 – 2009","author":"Merc_TV","url":"https://sketchfab.com/3d-models/volkswagen-polo-3-door-mk4-2001-2009-6fd9f1259b8248059e32f983cf5b0cf7","license":"CC BY 4.0"}},
  {"key":"audi-a4-b5","generation":"Audi A4 B5","lengthM":4.75,"rotateY":0,"groundOffset":0,"paintNodes":[],"paintMaterials":["Car_Paint_-_All_Colors"],"rimsSwappable":false,"wing":{"x":0,"y":0,"z":0,"scale":1},"rack":{"x":0,"y":0,"z":0,"scale":1},"credit":{"title":"Audi A4 (B5)","author":"MMC Works","url":"https://sketchfab.com/3d-models/audi-a4-b5-b5861ddefcb8478b858b3150aa44cd7f","license":"CC BY 4.0"}},
  {"key":"audi-q3-8u","generation":"Audi Q3 8U","lengthM":4.4,"rotateY":0,"groundOffset":0,"paintNodes":[],"paintMaterials":["Carro_Pintura"],"rimsSwappable":false,"wing":{"x":0,"y":0,"z":0,"scale":1},"rack":{"x":0,"y":0,"z":0,"scale":1},"credit":{"title":"2014 Audi Q3","author":"tonielpro520","url":"https://sketchfab.com/3d-models/2014-audi-q3-d95e025603c9449997be95048d10af68","license":"CC BY 4.0"}},
  {"key":"manual-19febfb9-3b4a-4a5f-b2c0-ce33547da350-ad65d3b3205c45de","rack":{"x":0,"y":0,"z":0,"scale":1},"wing":{"x":0,"y":0,"z":0,"scale":1},"credit":{"url":"https://sketchfab.com/3d-models/volkswagen-beetle-83276f21bd9c41e196c474350b43efb0","title":"Volkswagen beetle","author":"Angelos Gkanias","license":"CC Attribution"},"lengthM":4.5,"rotateY":0,"generation":"Volkswagen Beetle Type 1","paintNodes":[],"preRotateX":0,"groundOffset":0,"rimsSwappable":false,"paintMaterials":[]},
];

export const modelFile = (m: CarModel) => `${m.key}.glb`;

/** The real model of the car's generation (the server resolves / the customer picks it), or null = coming soon. */
export function modelFor(car: Pick<Car, "generation"> | null): CarModel | null {
  const key = car?.generation?.model3dKey;
  return (key && CAR_MODELS.find((m) => m.key === key)) || null;
}
