/** The value name on Windows and the preference key on macOS. */
export const CONTAINER_VALUE = "ManagedSettings";

/**
 * Reads the desktop client's managed-settings container value from the host's Unified Endpoint
 * Management channel. Each platform stores the value differently, and every platform stores exactly
 * one of them. This is client configuration, not Vault Data, and involves no cryptography.
 */
export abstract class ManagedSettingsSource {
  /** The host location this source reads, for logs. */
  abstract readonly location: string;
  /** The container value as the administrator wrote it, or undefined when the host declares none. */
  abstract read(): Promise<string | undefined>;
  /** Invokes `onChanged` whenever the host's managed configuration changes. */
  abstract watch(onChanged: () => void): Promise<void>;
}
