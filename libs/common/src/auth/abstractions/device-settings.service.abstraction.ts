import { Observable } from "rxjs";

/**
 * Reads and writes per-device settings for the current device. Values are scoped to a single
 * device and are not shared across the user's other clients. Holds the new/legacy UI preference
 * today; add a typed accessor here as each new per-device setting is introduced.
 *
 * Reads are served from cached local (per-account) state, so they are cheap and safe to consume
 * anywhere in the authenticated app — including offline. Call {@link refreshFromServer} to pull
 * the latest value from the server (e.g. on login/sync or when opening a settings screen).
 */
export abstract class DeviceSettingsServiceAbstraction {
  /**
   * Whether the new-UI beta is available at all (gated by the NewUiBetaSwitch feature flag). When
   * false, the new UI is unavailable regardless of the per-device setting, and the toggle should
   * be hidden.
   */
  abstract newUiBetaEnabled$: Observable<boolean>;

  /**
   * Whether the current device has opted into the new UI. Backed by local state (no network per
   * read). Forced to false when {@link newUiBetaEnabled$} is false; otherwise defaults to false
   * (legacy UI) until refreshed from the server.
   */
  abstract useNewUi$: Observable<boolean>;

  /**
   * Persists the new/legacy UI preference for the current device to the server and updates the
   * cached local state.
   */
  abstract setUseNewUi(useNewUi: boolean): Promise<void>;

  /**
   * Fetches the current device from the server and updates the cached local state.
   */
  abstract refreshFromServer(): Promise<void>;
}
