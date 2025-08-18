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
