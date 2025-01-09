/**
 * Default storage location options.
 *
 * `disk` generally means state that is accessible between restarts of the application,
 * with the exception of the web client. In web this means `sessionStorage`. The data
 * persists through refreshes of the page but not available once that tab is closed or
 * from any other tabs.
 *
 * `memory` means that the information stored there goes away during application
 * restarts.
 */
export type StorageLocation = "disk" | "memory";

/**
 * *Note*: The property names of this object should match exactly with the string values of the {@link ClientType} enum
 */
export type ClientLocations = {
  /**
   * Overriding storage location for the web client.
   *
   * Includes an extra storage location to store data in `localStorage`
   * that is available from different tabs and after a tab has closed.
   */
  web: StorageLocation | "disk-local";
  /**
   * Overriding storage location for browser clients.
   *
   * `"memory-large-object"` is used to store non-countable objects in memory. This exists due to limited persistent memory available to browser extensions.
   *
   * `"disk-backup-local-storage"` is used to store object in both disk and in `localStorage`. Data is stored in both locations but is only retrieved
   * from `localStorage` when a null-ish value is retrieved from disk first.
   */
  browser: StorageLocation | "memory-large-object" | "disk-backup-local-storage";
  /**
   * Overriding storage location for desktop clients.
   */
  //desktop: StorageLocation;
  /**
   * Overriding storage location for CLI clients.
   */
  //cli: StorageLocation;
};

/**
 * Defines the base location and instruction of where this state is expected to be located.
 */
export class StateDefinition {
  readonly storageLocationOverrides: Partial<ClientLocations>;

  /**
   * Creates a new instance of {@link StateDefinition}, the creation of which is owned by the platform team.
   * @param name The name of the state, this needs to be unique from all other {@link StateDefinition}'s.
   * @param defaultStorageLocation The location of where this state should be stored.
   */
  constructor(
    readonly name: string,
    readonly defaultStorageLocation: StorageLocation,
    storageLocationOverrides?: Partial<ClientLocations>,
  ) {
    this.storageLocationOverrides = storageLocationOverrides ?? {};
  }
}
