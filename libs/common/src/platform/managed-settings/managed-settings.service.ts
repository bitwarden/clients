// Stand-in for PM-27720 (Managed Settings). The real abstraction also carries
// `client$: Observable<ManagedSettingsClient>`, a handle to the SDK's WASM managed-settings
// client; that type is omitted here because the pinned SDK does not export it.

import { Observable } from "rxjs";

import { ManagementProfile } from "./management-profile";

export abstract class ManagedSettingsService {
  /** Raw JSON-encoded value for `key`, or undefined when unmanaged. */
  abstract get(key: string): string | undefined;
  /** {@link get} seeded with the current value. Re-emits upon a call to {@link updateProfile}. */
  abstract get$(key: string): Observable<string | undefined>;
  /** True when `key` is present in the active profile. */
  abstract isManaged(key: string): boolean;
  /** Push a new Unified Endpoint Management profile. Pass `undefined` to clear the active profile. */
  abstract updateProfile(profile: ManagementProfile | undefined): void;
}
