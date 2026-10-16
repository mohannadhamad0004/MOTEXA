// Allowed values of PartsProduct.condition and PartsProduct.partType (the Prisma enums). Kept as plain lists so the
// routes can check request input before it reaches the database.
export const CONDITIONS = ["NEW", "USED", "REFURBISHED"] as const;
export const PART_TYPES = ["OEM", "AFTERMARKET"] as const;
