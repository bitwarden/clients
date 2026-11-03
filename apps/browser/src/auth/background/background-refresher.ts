/**
 * Background work that must run again when the active account changes or a user logs out.
 */
export interface BackgroundRefresher {
  /**
   * Rebuilds the context menu for the active account.
   * @param forLocked When true, shows only the menu entries for a locked or logged-out vault.
   */
  refreshMenu(forLocked?: boolean): Promise<void>;

  /** Reloads the ciphers that the inline autofill menu shows. */
  updateOverlayCiphers(): Promise<void>;

  /** Refills the local storage buffer in browsers that need it. */
  reseedStorage(): Promise<void>;
}
