// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/key-management";

/**
 * Data stored for new SSO users that need to be converted to TideCloak key management.
 * This is stored temporarily in state while the user confirms the TideCloak domain.
 */
export interface NewSsoUserTideCloakConversion {
  /** KDF configuration for master key derivation */
  kdfConfig: KdfConfig;
  /** The TideCloak service URL for SDK initialization */
  tideCloakUrl: string;
  /** The organization ID the user is joining */
  organizationId: string;
}
