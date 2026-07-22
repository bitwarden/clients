import { Observable } from "rxjs";

import { ManagedSettingsClient, ManagementProfile } from "@bitwarden/sdk-internal";

/**
 * Access to administrator-forced client configuration acquired from an operating system's Unified
 * Endpoint Management (UEM/MDM) channel.
 *
 * Managed settings are client configuration, not Vault Data, and involve no cryptography. A key's
 * presence in the active profile means the value is forced by an administrator. A consumer reads a
 * managed value through {@link get} or {@link get$} and guards any write of the associated state
 * with {@link isManaged}, only writing when the key is not managed.
 */
export abstract class ManagedSettingsService {
  /** The shared WASM handle, available once the SDK WASM module has loaded. */
  abstract client$: Observable<ManagedSettingsClient>;
  /** Raw JSON-encoded value for `key`, or undefined when unmanaged. */
  abstract get(key: string): string | undefined;
  /** {@link get} seeded with the current value. Re-emits upon a call to {@link updateProfile}. */
  abstract get$(key: string): Observable<string | undefined>;
  /** True when `key` is present in the active profile. */
  abstract isManaged(key: string): boolean;
  /** Push a new Unified Endpoint Management profile. Pass `undefined` to clear the active profile. */
  abstract updateProfile(profile: ManagementProfile | undefined): void;
}
