import { Injectable } from "@angular/core";
import { firstValueFrom, from, map, mergeMap, Observable, switchMap, take } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  CollectionService,
  CollectionTypes,
  CollectionView,
} from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SingleUserState, StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import { COLLAPSED_GROUPINGS } from "@bitwarden/common/vault/services/key-state/collapsed-groupings.state";

import { DeprecatedVaultFilterService as DeprecatedVaultFilterServiceAbstraction } from "../../abstractions/deprecated-vault-filter.service";
import { DynamicTreeNode } from "../models/dynamic-tree-node.model";

const NestingDelimiter = "/";

@Injectable()
export class VaultFilterService implements DeprecatedVaultFilterServiceAbstraction {
  private collapsedGroupingsState(userId: UserId): SingleUserState<string[]> {
    return this.stateProvider.getUser(userId, COLLAPSED_GROUPINGS);
  }

  constructor(
    protected organizationService: OrganizationService,
    protected folderService: FolderService,
    protected cipherService: CipherService,
    protected collectionService: CollectionService,
    protected policyService: PolicyService,
    protected stateProvider: StateProvider,
    protected accountService: AccountService,
    protected configService: ConfigService,
    protected i18nService: I18nService,
  ) {}

  async storeCollapsedFilterNodes(
    collapsedFilterNodes: Set<string>,
    userId: UserId,
  ): Promise<void> {
    await this.collapsedGroupingsState(userId).update(() => Array.from(collapsedFilterNodes));
  }

  async buildCollapsedFilterNodes(userId: UserId): Promise<Set<string>> {
    return await firstValueFrom(
      this.collapsedGroupingsState(userId).state$.pipe(map((c) => new Set(c))),
    );
  }

  async buildOrganizations(): Promise<Organization[]> {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    let organizations = await firstValueFrom(this.organizationService.organizations$(userId));
    if (organizations != null) {
      organizations = organizations
        .filter((o) => o.isMember)
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    return organizations;
  }

  buildNestedFolders(organizationId?: string): Observable<DynamicTreeNode<FolderView>> {
    const transformation = async (storedFolders: FolderView[], userId: UserId) => {
      let folders: FolderView[];

      // If no org or "My Vault" is selected, show all folders
      if (organizationId == null || organizationId == "MyVault") {
        folders = storedFolders;
      } else {
        // Otherwise, show only folders that have ciphers from the selected org and the "no folder" folder
        const ciphers = await this.cipherService.getAllDecrypted(userId);
        const orgCiphers = ciphers.filter((c) => c.organizationId == organizationId);
        folders = storedFolders.filter(
          (f) => orgCiphers.some((oc) => oc.folderId == f.id) || f.id == null,
        );
      }

      const nestedFolders = await this.getAllFoldersNested(folders);
      return new DynamicTreeNode<FolderView>({
        fullList: folders,
        nestedList: nestedFolders,
      });
    };

    return this.accountService.activeAccount$.pipe(
      take(1),
      getUserId,
      switchMap((userId) =>
        this.folderService
          .folderViews$(userId)
          .pipe(mergeMap((folders) => from(transformation(folders, userId)))),
      ),
    );
  }

  async buildCollections(organizationId?: string): Promise<DynamicTreeNode<CollectionView>> {
    const storedCollections = await this.collectionService.getAllDecrypted();
    const orgs = await this.buildOrganizations();
    const defaulCollectionsFlagEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.CreateDefaultLocation,
    );

    let collections =
      organizationId == null
        ? storedCollections
        : storedCollections.filter((c) => c.organizationId === organizationId);

    if (defaulCollectionsFlagEnabled) {
      collections = sortDefaultCollections(collections, orgs, this.i18nService.collator);
    }

    const nestedCollections = await this.collectionService.getAllNested(collections);
    return new DynamicTreeNode<CollectionView>({
      fullList: collections,
      nestedList: nestedCollections,
    });
  }

  async checkForSingleOrganizationPolicy(): Promise<boolean> {
    return await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) =>
          this.policyService.policyAppliesToUser$(PolicyType.SingleOrg, userId),
        ),
      ),
    );
  }

  async checkForOrganizationDataOwnershipPolicy(): Promise<boolean> {
    return await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) =>
          this.policyService.policyAppliesToUser$(PolicyType.OrganizationDataOwnership, userId),
        ),
      ),
    );
  }

  protected async getAllFoldersNested(folders: FolderView[]): Promise<TreeNode<FolderView>[]> {
    const nodes: TreeNode<FolderView>[] = [];
    folders.forEach((f) => {
      const folderCopy = new FolderView();
      folderCopy.id = f.id;
      folderCopy.revisionDate = f.revisionDate;
      const parts = f.name != null ? f.name.replace(/^\/+|\/+$/g, "").split(NestingDelimiter) : [];
      ServiceUtils.nestedTraverse(nodes, 0, parts, folderCopy, undefined, NestingDelimiter);
    });
    return nodes;
  }

  async getFolderNested(id: string): Promise<TreeNode<FolderView>> {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const folders = await this.getAllFoldersNested(
      await firstValueFrom(this.folderService.folderViews$(activeUserId)),
    );
    return ServiceUtils.getTreeNodeObjectFromList(folders, id) as TreeNode<FolderView>;
  }
}

/**
 * Sorts collections with default user collections at the top, sorted by organization name.
 * Remaining collections are sorted by name.
 * @param collections - The list of collections to sort.
 * @param orgs - The list of organizations to use for sorting default user collections.
 * @returns Sorted list of collections.
 */
export function sortDefaultCollections(
  collections: CollectionView[],
  orgs: Organization[] = [],
  collator: Intl.Collator,
): CollectionView[] {
  const sortedDefaultCollectionTypes = collections
    .filter((c) => c.type === CollectionTypes.DefaultUserCollection)
    .sort((a, b) => {
      const aName = orgs.find((o) => o.id === a.organizationId)?.name ?? a.organizationId;
      const bName = orgs.find((o) => o.id === b.organizationId)?.name ?? b.organizationId;
      if (!aName || !bName) {
        throw new Error("Collection does not have an organizationId.");
      }
      return collator.compare(aName, bName);
    });
  return [
    ...sortedDefaultCollectionTypes,
    ...collections.filter((c) => c.type !== CollectionTypes.DefaultUserCollection),
  ];
}
