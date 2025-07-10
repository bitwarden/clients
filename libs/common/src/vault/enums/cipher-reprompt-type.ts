import { UnionOfValues } from "../types/union-of-values";

export const CipherRepromptType = {
  None: 0,
  Password: 1,
} as const;

export type CipherRepromptType = UnionOfValues<typeof CipherRepromptType>;
