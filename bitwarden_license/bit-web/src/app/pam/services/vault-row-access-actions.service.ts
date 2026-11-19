import { GatedRequestActionsService } from "@bitwarden/bit-pam-components";
import { VaultRowAccessActionsService } from "@bitwarden/web-vault/app/vault/components/vault-items/vault-row-access-actions.service";

/**
 * The web vault's row-menu binding of {@link GatedRequestActionsService}, which holds the shared
 * withdraw-request logic the desktop vault also uses.
 */
export class DefaultVaultRowAccessActionsService
  extends GatedRequestActionsService
  implements VaultRowAccessActionsService {}
