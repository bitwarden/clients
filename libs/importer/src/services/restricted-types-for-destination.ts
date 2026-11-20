import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedCipherType } from "@bitwarden/common/vault/services/restricted-item-types.service";

/**
 * The cipher types dropped from an import into a destination. Without an organization (My vault)
 * every restricted type is dropped; an organization keeps the types it allows.
 */
export function restrictedTypesForDestination(
  restricted: RestrictedCipherType[],
  organizationId?: string | null,
): CipherType[] {
  return restricted
    .filter((r) => organizationId == null || !r.allowViewOrgIds.includes(organizationId))
    .map((r) => r.cipherType);
}
