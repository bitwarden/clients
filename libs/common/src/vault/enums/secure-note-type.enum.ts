import { UnionOfValues } from "../types/union-of-values";

export const SecureNoteType = {
  Generic: 0,
} as const;

export type SecureNoteType = UnionOfValues<typeof SecureNoteType>;
