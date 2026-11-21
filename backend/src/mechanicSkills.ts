// The skills a mechanic can list in the application (MechanicProfile.specializations; mobile: features/mechanics/mechanicsService.ts).
// Catalog filters accept only these; an approved (VERIFIED) mechanic's listed skills are the ones customers see.
export const MECHANIC_SKILLS = ["Engine", "Brakes", "Electrical", "Diagnostics", "Air conditioning", "Transmission", "Suspension & steering", "Bodywork"] as const;
