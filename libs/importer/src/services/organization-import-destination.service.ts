import {
  combineLatest,
  defer,
  firstValueFrom,
  map,
  Observable,
  shareReplay,
  switchMap,
} from "rxjs";

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

import { ImportCollectionServiceAbstraction } from "./import-collection.service.abstraction";
import { hasUnassignedItemsAfterRestrictions, restrictionsFor } from "./import-destination-helpers";
import {
  ImportDestinationCollections,
  ImportDestinationServiceAbstraction,
} from "./import-destination.service.abstraction";
import { restrictedTypesForDestination } from "./restricted-types-for-destination";

/** The location step for an import started from an organization's admin console: the one
 *  organization, with all of its admin collections to choose from. The organization comes from
 *  `organizations$`, which includes one the user reaches only as a provider, so a provider user who
 *  passes the route guard gets the card. The legacy import checks permissions against the
 *  organization it finds the same way, though it builds its organization list from
 *  `memberOrganizations$`. */
export class OrganizationImportDestinationService implements ImportDestinationServiceAbstraction {
  constructor(
    private organizationId: OrganizationId,
    private organizationService: OrganizationService,
    private collectionService: ImportCollectionServiceAbstraction,
    private accountService: AccountService,
    private restrictedItemTypesService: RestrictedItemTypesService,
    private i18nService: I18nService,
    private policyService: PolicyService,
    private userCollections: ImportDestinationCollections,
  ) {}

  readonly destinations$: Observable<ImportDestinations> = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) =>
      combineLatest([
        this.organizationService.organizations$(userId),
        defer(() => this.collectionService.getAllAdminCollections(this.organizationId, userId)),
        this.restrictedItemTypesService.restricted$,
        this.policyService.policyAppliesToUser$(PolicyType.OrganizationDataOwnership, userId),
        this.userCollections.decryptedCollections$(userId),
      ]),
    ),
    map(([orgs, collections, restricted, policyApplies, ownCollections]) =>
      this.build(orgs, collections, restricted, policyApplies, ownCollections),
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
    restricted: RestrictedCipherType[],
    policyApplies: boolean,
    ownCollections: CollectionView[],
  ): ImportDestinations {
    const org = orgs.find((o) => o.id === this.organizationId);
    // Always a step: without one the controls would import into the user's own vault.
    if (org == null) {
      return { options: [], hasStep: true };
    }

    // Every admin collection, default ones included, as the legacy import lists them.
    const sharedFolders = [...collections].sort(
      Utils.getSortFunction<CollectionView>(this.i18nService, "name"),
    );
    // As the legacy import does when the ownership policy applies to the user: the items start in
    // their own My items collection in this organization. It is picked from the admin list, so the
    // dropdown holds the very object it selects.
    const ownMyItems = policyApplies
      ? ownCollections.find((c) => c.organizationId === org.id && c.isDefaultCollection)
      : undefined;
    const defaultSharedFolder =
      ownMyItems == null ? undefined : sharedFolders.find((c) => c.id === ownMyItems.id);

    const option: ImportDestinationOption = {
      id: `organization:${org.id}`,
      kind: ImportDestinationKind.Organization,
      organizationId: this.organizationId,
      organizationName: org.name,
      productTierType: org.productTierType,
      sharedFolders,
      restrictions: restrictionsFor([org], restricted),
      removedTypes: restrictedTypesForDestination(restricted, org.id),
      allowsUnassignedItems: org.canAccessImport,
      lockedToOrganization: true,
      defaultSharedFolder,
    };
    return { options: [option], hasStep: true };
  }
}
