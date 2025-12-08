// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/key-management";

export interface NewSsoUserKeyConnectorConversion {
  kdfConfig: KdfConfig;
  keyConnectorUrl: string;
  organizationId: string;
}
