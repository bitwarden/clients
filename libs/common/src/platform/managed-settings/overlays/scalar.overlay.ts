import { KeyDefinition, UserKeyDefinition } from "@bitwarden/state";

import { defineManagedOverlay } from "../managed-overlay-registry";

/** Parses a JSON-decoded leaf into `T`, or returns null when it is the wrong shape. */
export type LeafParser<T> = (raw: unknown) => T | null;

export const booleanLeaf: LeafParser<boolean> = (raw) => (typeof raw === "boolean" ? raw : null);

export const stringLeaf: LeafParser<string> = (raw) => (typeof raw === "string" ? raw : null);

/** Builds a parser that accepts only one of the listed string values (no `as` needed). */
export function enumLeaf<T extends string>(values: readonly T[]): LeafParser<T> {
  return (raw) => {
    for (const value of values) {
      if (value === raw) {
        return value;
      }
    }
    return null;
  };
}

/**
 * Registers a managed overlay for a scalar state key. When the managed profile contains
 * `managedKey`, the overlaid state read returns the parsed value; a malformed or wrong-typed
 * value is treated as absent (the stored value resurfaces), never thrown.
 */
export function defineScalarOverlay<T>(
  keyDefinition: KeyDefinition<T> | UserKeyDefinition<T>,
  managedKey: string,
  parse: LeafParser<T>,
): void {
  defineManagedOverlay({
    keyDefinition,
    coerce: (get) => {
      const raw = get(managedKey);
      if (raw == null) {
        return null;
      }
      try {
        return parse(JSON.parse(raw));
      } catch {
        return null;
      }
    },
  });
}
