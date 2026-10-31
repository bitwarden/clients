import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { RestrictedCipherType } from "@bitwarden/common/vault/services/restricted-item-types.service";

import { ImportDestinationRestriction } from "../models/import-destination";
import { ImportResult } from "../models/import-result";

import { countAfterRemoval, countCipherTypes } from "./item-type-counts";
import { restrictedTypesForDestination } from "./restricted-types-for-destination";

/** An org restricts a type when it is restricted for the user and this org doesn't allow it. */
export function restrictionsFor(
  orgs: readonly Organization[],
  restricted: RestrictedCipherType[],
): ImportDestinationRestriction[] {
  return orgs.flatMap((org) => {
    const types = restrictedTypesForDestination(restricted, org.id).sort((a, b) => a - b);
    return types.length > 0 ? [{ organizationName: org.name, types }] : [];
  });
}

/** Whether some items would be in no collection once the destination's restricted types are removed. */
export function hasUnassignedItemsAfterRestrictions(
  result: ImportResult,
  restricted: RestrictedCipherType[],
  organizationId?: OrganizationId,
): boolean {
  const importable = countAfterRemoval(
    countCipherTypes(result.ciphers),
    restrictedTypesForDestination(restricted, organizationId),
  );
  return result.collectionRelationships.length < importable;
}
