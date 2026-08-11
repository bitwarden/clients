// Stand-in for PM-27720 (Managed Settings). Replace with the SDK-backed `ManagementProfile`
// once `@bitwarden/sdk-internal` exports one.

/**
 * A point-in-time snapshot of the client configuration an administrator forced through the
 * host's Unified Endpoint Management (UEM) channel. Managed settings are client configuration,
 * not Vault Data. No encryption keys, authentication tokens, or cryptography pass through a
 * management profile.
 */
export interface ManagementProfile {
  version: number;
  /** Unix epoch seconds at which the profile was acquired from the host. */
  updatedAt: number;
  /** Dotted key to JSON-encoded leaf value. */
  settings: Map<string, string>;
}
