// lib/houseRoutes.ts
export const HOUSE_ROUTE_OVERRIDES_BY_ID: Record<string, { path: string; houseParam?: string }> = {
  "L0TeFf2LmrWGAaAyS8NY": { path: "/ezero-namelis", houseParam: "lake-house" },
  "PZwbfMYlSXj61uYYJutg": { path: "/dupleksas/salia-elniu-aptvaro", houseParam: "salia-elniu-aptvaro" },
  "oDzv9346CdaAsok162sX": { path: "/dupleksas/salia-elniu-panorama", houseParam: "salia-elniu-panorama" },
};

export const HOUSE_ROUTE_OVERRIDES_BY_SLUG: Record<string, { path: string; houseParam?: string }> = {
  "ezero-namelis": { path: "/ezero-namelis", houseParam: "lake-house" },
  "salia-elniu-aptvaro": { path: "/dupleksas/salia-elniu-aptvaro", houseParam: "salia-elniu-aptvaro" },
  "salia-elniu-panorama": { path: "/dupleksas/salia-elniu-panorama", houseParam: "salia-elniu-panorama" },
};
