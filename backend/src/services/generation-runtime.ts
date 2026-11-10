// Stand-in geometry belongs only to an automated Node test process, never a development server.
export const testProviderRuntime = () => process.env.NODE_ENV === "test" && !!process.env.NODE_TEST_CONTEXT;
export const generationMode = () => testProviderRuntime() && process.env.VEHICLE3D_MODE !== "real" ? "mock" as const : "meshy" as const;
export const paidGenerationEnabled = () => testProviderRuntime() ? process.env.MESHY_ALLOW_PAID_GENERATION === "1" : process.env.MESHY_ALLOW_PAID_GENERATION !== "0";
export function requireFixtureRuntime() {
  if (!testProviderRuntime()) throw Object.assign(new Error("Test geometry is forbidden outside automated tests."), { code: "TEST_FIXTURE_ONLY" });
}
