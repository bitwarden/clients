/** Creates a union type consisting of all values within the record. */
export type UnionOfValues<T extends Record<string, unknown>> = T[keyof T];
