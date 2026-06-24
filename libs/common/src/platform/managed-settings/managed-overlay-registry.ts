import { KeyDefinition, UserKeyDefinition } from "@bitwarden/state";

export type ManagedOverlay<T> = {
  /** The state key whose reads this overlay overrides. */
  keyDefinition: KeyDefinition<T> | UserKeyDefinition<T>;
  /**
   * Build the overlaid state value from the managed profile, or null to skip.
   * `get(key)` returns a managed key's JSON-encoded value (undefined if absent).
   * A composite setting reads several dotted leaves; a scalar reads one.
   */
  coerce: (get: (key: string) => string | undefined) => T | null;
};

const overlays: ManagedOverlay<unknown>[] = [];

/** Register a managed overlay. Idempotent per keyDefinition. Call once per setting in the clients repo. */
export function defineManagedOverlay<T>(overlay: ManagedOverlay<T>): ManagedOverlay<T> {
  const existing = lookupOverlay(overlay.keyDefinition);
  if (existing != null) {
    return existing as ManagedOverlay<T>;
  }
  overlays.push(overlay as ManagedOverlay<unknown>);
  return overlay;
}

/** The overlay registered for `keyDefinition` (matched by reference), if any. */
export function lookupOverlay(
  keyDefinition: KeyDefinition<unknown> | UserKeyDefinition<unknown>,
): ManagedOverlay<unknown> | undefined {
  return overlays.find((o) => o.keyDefinition === keyDefinition);
}

export function registeredOverlays(): ReadonlyArray<ManagedOverlay<unknown>> {
  return overlays;
}

/** Test-only: clears the registry. Not part of the public API. */
export function __resetOverlaysForTests(): void {
  overlays.length = 0;
}
