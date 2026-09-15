export const AutotypeFeatureFlagState = Object.freeze({
  Off: 1,
  Mvp: 2,
  Ga: 3,
} as const);

export type AutotypeFeatureFlagState =
  (typeof AutotypeFeatureFlagState)[keyof typeof AutotypeFeatureFlagState];
