import { combineLatest, firstValueFrom, map, Observable, shareReplay, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";

import {
  ImportDestinationKind,
  ImportDestinationOption,
  ImportDestinations,
} from "../models/import-destination";
import { ImportResult } from "../models/import-result";

import { hasUnassignedItemsAfterRestrictions, restrictionsFor } from "./import-destination-helpers";
import {
  ImportDestinationCollections,
  ImportDestinationServiceAbstraction,
} from "./import-destination.service.abstraction";
import { restrictedTypesForDestination } from "./restricted-types-for-destination";

export class DefaultImportDestinationService implements ImportDestinationServiceAbstraction {
  constructor(
    private organizationService: OrganizationService,
    private collectionService: ImportDestinationCollections,
    private policyService: PolicyService,
    private accountService: AccountService,
    private restrictedItemTypesService: RestrictedItemTypesService,
    private i18nService: I18nService,
  ) {}

  readonly destinations$: Observable<ImportDestinations> = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) =>
      combineLatest([
        this.organizationService.memberOrganizations$(userId),
        this.collectionService.decryptedCollections$(userId),
        this.policyService.policiesByType$(PolicyType.OrganizationDataOwnership, userId),
        this.restrictedItemTypesService.restricted$,
      ]),
    ),
    map(([orgs, collections, ownershipPolicies, restricted]) =>
      this.build(
        orgs,
        collections,
        new Set(ownershipPolicies.map((policy) => policy.organizationId)),
        restricted,
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  async hasUnassignedItems(
    result: ImportResult,
    organizationId?: OrganizationId,
  ): Promise<boolean> {
    const restricted = await firstValueFrom(this.restrictedItemTypesService.restricted$);
    return hasUnassignedItemsAfterRestrictions(result, restricted, organizationId);
  }

  private build(
    orgs: Organization[],
    collections: CollectionView[],
    ownershipOrgIds: ReadonlySet<string>,
    restricted: RestrictedCipherType[],
  ): ImportDestinations {
    const sortByName = Utils.getSortFunction<Organization>(this.i18nService, "name");
    const sortedOrgs = [...orgs].sort(sortByName);
    const accessible = sortedOrgs.filter((org) => org.canAccess);
    const policyApplies = ownershipOrgIds.size > 0;

    // As in the legacy import: with the policy on there is no personal vault, so a user who manages
    // no collection in any org has nowhere to import and gets no location step to choose from.
    const canImportAnywhere = accessible.some((org) =>
      collections.some((c) => c.organizationId === org.id && c.manage),
    );
    if (policyApplies && !canImportAnywhere) {
      return { options: [], hasStep: false };
    }

    const options: ImportDestinationOption[] = [];
    if (!policyApplies) {
      options.push({
        id: "myVault",
        kind: ImportDestinationKind.MyVault,
        sharedFolders: [],
        restrictions: restrictionsFor(sortedOrgs, restricted),
        removedTypes: restrictedTypesForDestination(restricted),
      });
    }

    // My items leads, so orgs enforcing the policy come first; each My items sits before its org.
    const ordered = [
      ...accessible.filter((org) => ownershipOrgIds.has(org.id)),
      ...accessible.filter((org) => !ownershipOrgIds.has(org.id)),
    ];
    for (const org of ordered) {
      const orgId = org.id as OrganizationId;
      const orgCollections = collections.filter((c) => c.organizationId === org.id);
      // Items imported into an org follow that org's rule, not the other orgs'.
      const restrictions = restrictionsFor([org], restricted);
      const removedTypes = restrictedTypesForDestination(restricted, org.id);

      const defaultCollection = ownershipOrgIds.has(org.id)
        ? orgCollections.find((c) => c.isDefaultCollection)
        : undefined;
      if (defaultCollection != null) {
        options.push({
          id: `myItems:${org.id}`,
          kind: ImportDestinationKind.MyItems,
          organizationId: orgId,
          organizationName: org.name,
          productTierType: org.productTierType,
          defaultCollection,
          sharedFolders: [],
          restrictions,
          removedTypes,
        });
      }

      // The card is always offered; an org with no shared folder the user manages has an empty list.
      // Under the policy My items has its own card; without it a leftover My items collection is
      // listed, as in the legacy import.
      const sharedFolders = orgCollections
        .filter((c) => c.manage && (!c.isDefaultCollection || !ownershipOrgIds.has(org.id)))
        .sort(Utils.getSortFunction<CollectionView>(this.i18nService, "name"));
      options.push({
        id: `organization:${org.id}`,
        kind: ImportDestinationKind.Organization,
        organizationId: orgId,
        organizationName: org.name,
        productTierType: org.productTierType,
        sharedFolders,
        restrictions,
        removedTypes,
      });
    }

    return {
      options,
      hasStep: options.some((option) => option.kind !== ImportDestinationKind.MyVault),
    };
  }
}
