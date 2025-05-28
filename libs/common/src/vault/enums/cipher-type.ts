import { UnionOfValues } from "../types/union-of-values";

export const CipherType = {
  Login: 1,
  SecureNote: 2,
  Card: 3,
  Identity: 4,
  SshKey: 5,
} as const;

/**
 * Reverse mapping of Cipher Types to their associated names.
 * When represented as an enum in TypeScript, this mapping was provided
 * by default. Now using a constant object it needs to be defined manually.
 */
export const CipherTypeNames = {
  1: "Login",
  2: "SecureNote",
  3: "Card",
  4: "Identity",
  5: "SshKey",
} as const;

export type CipherType = UnionOfValues<typeof CipherType>;
