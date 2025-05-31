import { UnionOfValues } from "../types/union-of-values";

export const FieldType = {
  Text: 0,
  Hidden: 1,
  Boolean: 2,
  Linked: 3,
} as const;

export type FieldType = UnionOfValues<typeof FieldType>;
