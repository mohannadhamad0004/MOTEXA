/** Swap only media.*.path after reviewing artwork. All assets share 9:16 source coordinates. */
export type MediaPath = string | number;
export const cinematicConfig = {
  enabledInMainFlow: false,
  phase1End: .52,
  holdMs: 800,
  sourceSize: {width: 900, height: 1600},
  // Measured from the code-drawn placeholder source, not guessed viewport coordinates.
  windshield: {x:.313,y:.415,width:.374,height:.10625},
  screen: {x:.59,y:.48,width:.31,height:.14},
  instrument: {x:.30,y:.52},
  holdPoints: [0,.26,.35,.52],
  media: {
    EXT_HERO: {path:'assets/cinematic/placeholders/EXT_HERO.tsx' as MediaPath},
    INT_COCKPIT: {path:'assets/cinematic/placeholders/INT_COCKPIT.tsx' as MediaPath},
    INT_DASH_SCREEN: {path:'assets/cinematic/placeholders/INT_DASH_SCREEN.tsx' as MediaPath},
    // Always a still; the loop is implemented by scale + translation, never video.
    EXT_HERO_LOOP: {path:'still:EXT_HERO' as MediaPath},
  },
  scenes: [
    {id:'exterior',start:0,holdStart:0,holdEnd:.08,end:.22},
    {id:'cockpit',start:.08,holdStart:.22,holdEnd:.30,end:.40},
    {id:'promise',start:.30,holdStart:.33,holdEnd:.38,end:.40},
    {id:'screen',start:.40,holdStart:.49,holdEnd:.52,end:.52},
  ],
  words: {
    exterior:[['Your journey.','رحلتك.'],['In safe hands.','بأيدٍ أمينة.']],
    cockpit:[['In your world.','بعالمك.'],['By your side.','معك بطريقك.']],
    promise:[['Every mile.','كل طريق.'],['Together.','مع بعض.']],
  },
} as const;
