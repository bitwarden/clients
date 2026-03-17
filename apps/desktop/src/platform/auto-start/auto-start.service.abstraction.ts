/**
 * Represents the state of the auto-start configuration.
 */
export const AutoStartStatus = {
  /** Auto-start is enabled */
  Enabled: "enabled",
  /** Auto-start is disabled */
  Disabled: "disabled",
  /** Auto-start state cannot be determined (e.g., Flatpak/Snap) */
  Unknown: "unknown",
} as const;

export type AutoStartStatus = (typeof AutoStartStatus)[keyof typeof AutoStartStatus];

/**
 * Service for managing the application's auto-start behavior at system login.
 */
export abstract class AutoStartService {
  /**
   * Enables the application to automatically start when the user logs into their system.
   */
  abstract enable(): Promise<void>;

  /**
   * Disables the application from automatically starting when the user logs into their system.
   */
  abstract disable(): Promise<void>;

  /**
   * Checks whether the application is currently configured to start at login.
   * @returns The auto-start status: `Enabled`, `Disabled`, or `Unknown` if the state cannot be determined.
   */
  abstract isEnabled(): Promise<AutoStartStatus>;
}
