export const WhoCanAccessType = Object.freeze({
  Any: 0,
  PasswordProtected: 1,
  SpecificPeople: 2,
} as const);
export type WhoCanAccessType = (typeof WhoCanAccessType)[keyof typeof WhoCanAccessType];
