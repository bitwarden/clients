import { StorageLocation } from "./storage-location";

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
