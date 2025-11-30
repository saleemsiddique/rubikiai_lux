// lib/houseNames.ts
/**
 * Maps house IDs to their display names
 */
export const HOUSE_ID_TO_NAME: Record<string, string> = {
  "L0TeFf2LmrWGAaAyS8NY": "Ežero Namelis",
  "PZwbfMYlSXj61uYYJutg": "Duplex Nr.1 - Šalia Elnių Aptvaro",
  "oDzv9346CdaAsok162sX": "Duplex Nr.2 - Elnių Panorama",
};

/**
 * Converts house ID(s) to display name(s)
 * @param houseIdOrIds - Single ID, array of IDs, or comma/underscore-separated string
 * @returns Formatted house name(s)
 */
export function getHouseDisplayName(houseIdOrIds: string | string[] | null | undefined): string {
  if (!houseIdOrIds) return "Accommodation";

  let ids: string[];

  // Handle different input formats
  if (Array.isArray(houseIdOrIds)) {
    ids = houseIdOrIds;
  } else if (typeof houseIdOrIds === "string") {
    // Split by "__" (dual booking format) or "," (comma-separated)
    if (houseIdOrIds.includes("__")) {
      ids = houseIdOrIds.split("__").map(id => id.trim()).filter(Boolean);
    } else if (houseIdOrIds.includes(",")) {
      ids = houseIdOrIds.split(",").map(id => id.trim()).filter(Boolean);
    } else {
      ids = [houseIdOrIds.trim()];
    }
  } else {
    return "Accommodation";
  }

  // Map IDs to names
  const names = ids.map(id => HOUSE_ID_TO_NAME[id] || id);

  // Return formatted string
  if (names.length === 0) return "Accommodation";
  if (names.length === 1) return names[0];
  return names.join(" + ");
}
