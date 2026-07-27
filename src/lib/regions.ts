export const REGIONS = [
  "Norte",
  "Centro Norte",
  "Centro Sul 1",
  "Centro Sul 2",
  "Sul",
] as const;

export type Region = (typeof REGIONS)[number];
