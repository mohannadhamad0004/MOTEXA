// The skills a mechanic can claim at signup (same names as mobile/src/app/auth/mechanic-signup.tsx).
// Catalog filters accept only these; a mechanic's profile shows only the ones an admin APPROVED.
export const MECHANIC_SKILLS = ["Engine", "Brakes", "Electrical", "Diagnostics", "Air conditioning", "Transmission", "Suspension & steering", "Bodywork"] as const;
