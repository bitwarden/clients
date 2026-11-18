/** One key the renderer pushes to the SSH agent's in-memory keystore. */
export type SshAgentKey = {
  name: string;
  privateKey: string;
  cipherId: string;
  /**
   * Unix time in milliseconds after which the native agent neither lists nor signs with the key.
   * Set only for a key the vault lends for a limited time (a leased, gated item); absent for an
   * ordinary key, which does not expire.
   */
  expiresAt?: number;
};
