import { KeyDefinition, UserKeyDefinition } from "@bitwarden/state";

export type ManagedOverlay<T> = {
  /** Dotted managed key, e.g. "environment" or "vault.timeout". */
  managedKey: string;
  /** The state key whose reads this managed value overrides. */
  keyDefinition: KeyDefinition<T> | UserKeyDefinition<T>;
  /** Coerce the profile's JSON-encoded string into the state value, or null to skip. */
  coerce: (raw: string) => T | null;
};

const overlays: ManagedOverlay<unknown>[] = [];

/** Register a managed overlay. Call once per setting, at module load, in the clients repo. */
export function defineManagedOverlay<T>(overlay: ManagedOverlay<T>): ManagedOverlay<T> {
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
