import { Observable } from "rxjs";

import type { ManagedSettingsClient, ManagementProfile } from "@bitwarden/sdk-internal";

/**
 * Owns the process-wide managed-settings handle and exposes reads plus a
 * change signal. Acquisition layers (browser/desktop/CLI) call `updateProfile`;
 * the StateProvider overlay reads `isManaged`/`get` and re-emits on `changes$`.
 */
export abstract class ManagedSettingsService {
  /** The shared wasm handle, available once the SDK wasm module has loaded. */
  abstract handle$: Observable<ManagedSettingsClient>;
  /** Fires whenever the active profile is replaced. */
  abstract changes$: Observable<void>;
  /** True when `key` is present in the active profile. */
  abstract isManaged(key: string): boolean;
  /** The raw JSON-encoded value for `key`, or undefined when unmanaged. */
  abstract get(key: string): string | undefined;
  /** Replace the active profile (acquisition layers call this). */
  abstract updateProfile(profile: ManagementProfile | undefined): void;
  /** Dev/test helper: build a profile from an in-code map and push it. */
  abstract pushExplicit(values: Record<string, unknown>): void;
}
