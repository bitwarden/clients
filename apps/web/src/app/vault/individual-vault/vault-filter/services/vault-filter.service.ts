// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import {
  BehaviorSubject,
  combineLatest,
  combineLatestWith,
  filter,
  firstValueFrom,
  map,
  Observable,
  of,
  switchMap,
} from "rxjs";

import {
  CollectionAdminView,
  CollectionService,
  CollectionView,
} from "@bitwarden/admin-console/common";
import { sortDefaultCollections } from "@bitwarden/angular/vault/vault-filter/services/vault-filter.service";
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
import { CipherType } from "@bitwarden/common/vault/enums";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import { COLLAPSED_GROUPINGS } from "@bitwarden/common/vault/services/key-state/collapsed-groupings.state";
import { CipherListView } from "@bitwarden/sdk-internal";

import {
  CipherTypeFilter,
  CollectionFilter,
  FolderFilter,
  OrganizationFilter,
} from "../shared/models/vault-filter.type";

import { VaultFilterService as VaultFilterServiceAbstraction } from "./abstractions/vault-filter.service";

const NestingDelimiter = "/";

@Injectable()
export class VaultFilterService implements VaultFilterServiceAbstraction {
  protected activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);

  memberOrganizations$ = this.activeUserId$.pipe(
    switchMap((id) => this.organizationService.memberOrganizations$(id)),
  );

  collapsedFilterNodes$ = this.activeUserId$.pipe(
    switchMap((id) => this.collapsedGroupingsState(id).state$),
    map((state) => new Set(state)),
  );

  organizationTree$: Observable<TreeNode<OrganizationFilter>> = combineLatest([
    this.memberOrganizations$,
    this.activeUserId$.pipe(
      switchMap((userId) => this.policyService.policyAppliesToUser$(PolicyType.SingleOrg, userId)),
    ),
    this.activeUserId$.pipe(
      switchMap((userId) =>
        this.policyService.policyAppliesToUser$(PolicyType.OrganizationDataOwnership, userId),
      ),
    ),
  ]).pipe(
    switchMap(([orgs, singleOrgPolicy, organizationDataOwnershipPolicy]) =>
      this.buildOrganizationTree(orgs, singleOrgPolicy, organizationDataOwnershipPolicy),
    ),
  );

  protected _organizationFilter = new BehaviorSubject<Organization>(null);

  filteredFolders$: Observable<FolderView[]> = this.activeUserId$.pipe(
    switchMap((userId) =>
      combineLatest([
        this.folderService.folderViews$(userId),
        this.cipherService.cipherListViews$(userId),
        this._organizationFilter,
      ]),
    ),
    filter(([folders, ciphers, org]) => !!ciphers), // ciphers may be null, meaning decryption is in progress. Ignore this emission
    switchMap(([folders, ciphers, org]) => {
      return this.filterFolders(folders, ciphers, org);
    }),
  );

  folderTree$: Observable<TreeNode<FolderFilter>> = this.filteredFolders$.pipe(
    map((folders) => this.buildFolderTree(folders)),
  );

  filteredCollections$: Observable<CollectionView[]> =
    this.collectionService.decryptedCollections$.pipe(
      combineLatestWith(this._organizationFilter),
      switchMap(([collections, org]) => {
        return this.filterCollections(collections, org);
      }),
    );

  collectionTree$: Observable<TreeNode<CollectionFilter>> = combineLatest([
    this.filteredCollections$,
    this.memberOrganizations$,
    this.configService.getFeatureFlag$(FeatureFlag.CreateDefaultLocation),
  ]).pipe(
    map(([collections, organizations, defaultCollectionsFlagEnabled]) =>
      this.buildCollectionTree(collections, organizations, defaultCollectionsFlagEnabled),
    ),
  );

  cipherTypeTree$: Observable<TreeNode<CipherTypeFilter>> = this.buildCipherTypeTree();

  private collapsedGroupingsState(userId: UserId): SingleUserState<string[]> {
    return this.stateProvider.getUser(userId, COLLAPSED_GROUPINGS);
  }

  constructor(
    protected organizationService: OrganizationService,
    protected folderService: FolderService,
    protected cipherService: CipherService,
    protected policyService: PolicyService,
    protected i18nService: I18nService,
    protected stateProvider: StateProvider,
    protected collectionService: CollectionService,
    protected accountService: AccountService,
    protected configService: ConfigService,
  ) {}

  async getCollectionNodeFromTree(id: string) {
    const collections = await firstValueFrom(this.collectionTree$);
    return ServiceUtils.getTreeNodeObject(collections, id) as TreeNode<CollectionFilter>;
  }

  async setCollapsedFilterNodes(collapsedFilterNodes: Set<string>, userId: UserId): Promise<void> {
    await this.collapsedGroupingsState(userId).update(() => Array.from(collapsedFilterNodes));
  }

  protected async getCollapsedFilterNodes(): Promise<Set<string>> {
    return await firstValueFrom(this.collapsedFilterNodes$);
  }

  getOrganizationFilter() {
    return this._organizationFilter;
  }

  clearOrganizationFilter() {
    this._organizationFilter.next(null);
  }

  setOrganizationFilter(organization: Organization) {
    if (organization?.id != "AllVaults") {
      this._organizationFilter.next(organization);
    } else {
      this._organizationFilter.next(null);
    }
  }

  async expandOrgFilter(userId: UserId) {
    const collapsedFilterNodes = await firstValueFrom(this.collapsedFilterNodes$);
    if (!collapsedFilterNodes.has("AllVaults")) {
      return;
    }
    collapsedFilterNodes.delete("AllVaults");
    await this.setCollapsedFilterNodes(collapsedFilterNodes, userId);
  }

  protected async buildOrganizationTree(
    orgs: Organization[],
    singleOrgPolicy: boolean,
    organizationDataOwnershipPolicy: boolean,
  ): Promise<TreeNode<OrganizationFilter>> {
    const headNode = this.getOrganizationFilterHead();
    if (!organizationDataOwnershipPolicy) {
      const myVaultNode = this.getOrganizationFilterMyVault();
      headNode.children.push(myVaultNode);
    }
    if (singleOrgPolicy) {
      orgs = orgs.slice(0, 1);
    }
    if (orgs) {
      const orgNodes: TreeNode<OrganizationFilter>[] = [];
      orgs.forEach((org) => {
        const orgCopy = org as OrganizationFilter;
        orgCopy.icon = "bwi-business";
        const node = new TreeNode<OrganizationFilter>(orgCopy, headNode, orgCopy.name);
        orgNodes.push(node);
      });
      // Sort organization nodes, then add them to the list after 'My Vault' and 'All Vaults' if present
      orgNodes.sort((a, b) => a.node.name.localeCompare(b.node.name));
      headNode.children.push(...orgNodes);
    }
    return headNode;
  }

  protected getOrganizationFilterHead(): TreeNode<OrganizationFilter> {
    const head = new Organization() as OrganizationFilter;
    head.enabled = true;
    return new TreeNode<OrganizationFilter>(head, null, "allVaults", "AllVaults");
  }

  protected getOrganizationFilterMyVault(): TreeNode<OrganizationFilter> {
    const myVault = new Organization() as OrganizationFilter;
    myVault.id = "MyVault";
    myVault.icon = "bwi-user";
    myVault.enabled = true;
    myVault.hideOptions = true;
    return new TreeNode<OrganizationFilter>(myVault, null, this.i18nService.t("myVault"));
  }

  buildTypeTree(
    head: CipherTypeFilter,
    array?: CipherTypeFilter[],
  ): Observable<TreeNode<CipherTypeFilter>> {
    const headNode = new TreeNode<CipherTypeFilter>(head, null);
    array?.forEach((filter) => {
      const node = new TreeNode<CipherTypeFilter>(filter, headNode, filter.name);
      headNode.children.push(node);
    });
    return of(headNode);
  }

  protected async filterCollections(
    storedCollections: CollectionView[],
    org?: Organization,
  ): Promise<CollectionView[]> {
    return org?.id != null
      ? storedCollections.filter((c) => c.organizationId === org.id)
      : storedCollections;
  }

  protected buildCollectionTree(
    collections?: CollectionView[],
    orgs?: Organization[],
    defaultCollectionsFlagEnabled?: boolean,
  ): TreeNode<CollectionFilter> {
    const headNode = this.getCollectionFilterHead();
    if (!collections) {
      return headNode;
    }
    const nodes: TreeNode<CollectionFilter>[] = [];

    if (defaultCollectionsFlagEnabled) {
      collections = sortDefaultCollections(collections, orgs, this.i18nService.collator);
    }

    collections.forEach((c) => {
      const collectionCopy = new CollectionView() as CollectionFilter;
      collectionCopy.id = c.id;
      collectionCopy.organizationId = c.organizationId;
      collectionCopy.icon = "bwi-collection-shared";
      if (c instanceof CollectionAdminView) {
        collectionCopy.groups = c.groups;
        collectionCopy.assigned = c.assigned;
      }
      const parts = c.name != null ? c.name.replace(/^\/+|\/+$/g, "").split(NestingDelimiter) : [];
      ServiceUtils.nestedTraverse(nodes, 0, parts, collectionCopy, null, NestingDelimiter);
    });

    nodes.forEach((n) => {
      n.parent = headNode;
      headNode.children.push(n);
    });

    return headNode;
  }

  protected getCollectionFilterHead(): TreeNode<CollectionFilter> {
    const head = new CollectionView() as CollectionFilter;
    return new TreeNode<CollectionFilter>(head, null, "collections", "AllCollections");
  }

  protected async filterFolders(
    storedFolders: FolderView[],
    ciphers: CipherView[] | CipherListView[],
    org?: Organization,
  ): Promise<FolderView[]> {
    // If no org or "My Vault" is selected, show all folders
    if (org?.id == null || org?.id == "MyVault") {
      return storedFolders;
    }

    // Otherwise, show only folders that have ciphers from the selected org and the "no folder" folder
    const orgCiphers = ciphers.filter((c) => c.organizationId == org?.id);
    return storedFolders.filter(
      (f) => orgCiphers.some((oc) => oc.folderId == f.id) || f.id == null,
    );
  }

  protected buildFolderTree(folders?: FolderView[]): TreeNode<FolderFilter> {
    const headNode = this.getFolderFilterHead();
    if (!folders) {
      return headNode;
    }
    const nodes: TreeNode<FolderFilter>[] = [];
    folders.forEach((f) => {
      const folderCopy = new FolderView() as FolderFilter;
      folderCopy.id = f.id;
      folderCopy.revisionDate = f.revisionDate;
      folderCopy.icon = "bwi-folder";
      folderCopy.fullName = f.name; // save full folder name before separating it into parts
      const parts = f.name != null ? f.name.replace(/^\/+|\/+$/g, "").split(NestingDelimiter) : [];
      ServiceUtils.nestedTraverse(nodes, 0, parts, folderCopy, null, NestingDelimiter);
    });

    nodes.forEach((n) => {
      n.parent = headNode;
      headNode.children.push(n);
    });
    return headNode;
  }

  protected getFolderFilterHead(): TreeNode<FolderFilter> {
    const head = new FolderView() as FolderFilter;
    return new TreeNode<FolderFilter>(head, null, "folders", "AllFolders");
  }

  protected buildCipherTypeTree(): Observable<TreeNode<CipherTypeFilter>> {
    const allTypeFilters: CipherTypeFilter[] = [
      {
        id: "favorites",
        name: this.i18nService.t("favorites"),
        type: "favorites",
        icon: "bwi-star",
      },
      {
        id: "login",
        name: this.i18nService.t("typeLogin"),
        type: CipherType.Login,
        icon: "bwi-globe",
      },
      {
        id: "card",
        name: this.i18nService.t("typeCard"),
        type: CipherType.Card,
        icon: "bwi-credit-card",
      },
      {
        id: "identity",
        name: this.i18nService.t("typeIdentity"),
        type: CipherType.Identity,
        icon: "bwi-id-card",
      },
      {
        id: "note",
        name: this.i18nService.t("typeSecureNote"),
        type: CipherType.SecureNote,
        icon: "bwi-sticky-note",
      },
      {
        id: "sshKey",
        name: this.i18nService.t("typeSshKey"),
        type: CipherType.SshKey,
        icon: "bwi-key",
      },
    ];

    return this.buildTypeTree(
      { id: "AllItems", name: "allItems", type: "all", icon: "" },
      allTypeFilters,
    );
  }
}
