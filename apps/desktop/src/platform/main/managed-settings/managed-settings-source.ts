/** The name an administrator gives the managed-settings container value on every platform. */
export const CONTAINER_VALUE = "ManagedSettings";

/**
 * Reads the desktop client's managed-settings container value from the host's Unified Endpoint
 * Management channel.
 */
export abstract class ManagedSettingsSource {
  /** The host location this source reads, for logs. */
  abstract readonly location: string;
  /** A JSON string representing administrator-managed settings. */
  abstract read(): Promise<string | undefined>;
  /** Invokes `onChanged` whenever the host's managed configuration changes. */
  abstract watch(onChanged: () => void): Promise<void>;
}
