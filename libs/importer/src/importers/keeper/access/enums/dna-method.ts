export const DnaMethod = Object.freeze({
  Push: 1,
  Code: 2,
} as const);
export type DnaMethod = (typeof DnaMethod)[keyof typeof DnaMethod];
