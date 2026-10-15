import { Observable } from "rxjs";

import { ManagedSettingsClient } from "@bitwarden/sdk-internal";

/**
 * Read access to the settings an administrator forces onto this client through the operating
 * system's Unified Endpoint Management (UEM/MDM) channel.
 *
 * A managed setting is not Vault Data and involves no cryptography. Values originate from the host
 * operating system rather than a Bitwarden server, so they are readable before login and before
 * unlock.
 *
 * A setting is only managed if a consumer explicitly opts in by reading it. Consumers reconcile the
 * managed value against their own state, and should guard writes of that state with
 * {@link isManaged} so that a forced value is never overwritten.
 *
 * A managed setting does not automatically take precedence over an enterprise policy. Where a
 * policy and a managed setting both bear on one effective setting, the consuming feature resolves
 * the conflict itself.
 *
 * Acquisition is asynchronous on every platform, so a profile may arrive after startup and a
 * consumer may not immediately observe a managed setting. The SDK holds the profile, so until the
 * SDK has loaded, {@link get} returns `undefined` and {@link isManaged} returns `false` for every key.
 * Consumers that run at startup should use {@link get$}.
 */
export abstract class ManagedSettingsService {
  /**
   * The shared SDK handle, available once the SDK WASM module has loaded.
   *
   * The handle holds the active profile. Hand it to the SDK client so the SDK reads the same
   * profile. A client's host acquisition code passes the administrator's raw settings to its
   * `update_from_json`; feature code never updates the profile.
   */
  abstract client$: Observable<ManagedSettingsClient>;

  /**
   * The raw JSON-encoded value stored under `key`, or `undefined` when `key` is not managed.
   *
   * Keys are dotted, for example `environment.base`. Callers parse the value themselves.
   */
  abstract get(key: string): string | undefined;

  /**
   * {@link get} as an observable, seeded with the current value so a subscriber never waits for a
   * host push. Re-emits when a pushed profile changes the value for `key`.
   */
  abstract get$(key: string): Observable<string | undefined>;

  /**
   * Whether `key` is present in the active profile. Presence implies the value is forced.
   */
  abstract isManaged(key: string): boolean;
}
