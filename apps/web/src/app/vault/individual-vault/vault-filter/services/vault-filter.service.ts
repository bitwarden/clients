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
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ActiveUserState, StateProvider } from "@bitwarden/common/platform/state";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import { COLLAPSED_GROUPINGS } from "@bitwarden/common/vault/services/key-state/collapsed-groupings.state";

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
  private activeUserId$ = this.accountService.activeAccount$.pipe(map((a) => a?.id));

  memberOrganizations$ = this.activeUserId$.pipe(
    switchMap((id) => this.organizationService.memberOrganizations$(id)),
  );

  organizationTree$: Observable<TreeNode<OrganizationFilter>> = combineLatest([
    this.memberOrganizations$,
    this.policyService.policyAppliesToActiveUser$(PolicyType.SingleOrg),
    this.policyService.policyAppliesToActiveUser$(PolicyType.PersonalOwnership),
  ]).pipe(
    switchMap(([orgs, singleOrgPolicy, personalOwnershipPolicy]) =>
      this.buildOrganizationTree(orgs, singleOrgPolicy, personalOwnershipPolicy),
    ),
  );

  protected _organizationFilter = new BehaviorSubject<Organization>(null);

  filteredFolders$: Observable<FolderView[]> = this.activeUserId$.pipe(
    switchMap((userId) =>
      combineLatest([
        this.folderService.folderViews$(userId),
        this.cipherService.cipherViews$(userId),
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

  collectionTree$: Observable<TreeNode<CollectionFilter>> = this.filteredCollections$.pipe(
    map((collections) => this.buildCollectionTree(collections)),
  );

  cipherTypeTree$: Observable<TreeNode<CipherTypeFilter>> = this.buildCipherTypeTree();

  private collapsedGroupingsState: ActiveUserState<string[]> =
    this.stateProvider.getActive(COLLAPSED_GROUPINGS);

  readonly collapsedFilterNodes$: Observable<Set<string>> =
    this.collapsedGroupingsState.state$.pipe(map((c) => new Set(c)));

  constructor(
    protected organizationService: OrganizationService,
    protected folderService: FolderService,
    protected cipherService: CipherService,
    protected policyService: PolicyService,
    protected i18nService: I18nService,
    protected stateProvider: StateProvider,
    protected collectionService: CollectionService,
    protected accountService: AccountService,
  ) {}

  async getCollectionNodeFromTree(id: string) {
    const collections = await firstValueFrom(this.collectionTree$);
    return ServiceUtils.getTreeNodeObject(collections, id) as TreeNode<CollectionFilter>;
  }

  async setCollapsedFilterNodes(collapsedFilterNodes: Set<string>): Promise<void> {
    await this.collapsedGroupingsState.update(() => Array.from(collapsedFilterNodes));
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

  async expandOrgFilter() {
    const collapsedFilterNodes = await firstValueFrom(this.collapsedFilterNodes$);
    if (!collapsedFilterNodes.has("AllVaults")) {
      return;
    }
    collapsedFilterNodes.delete("AllVaults");
    await this.setCollapsedFilterNodes(collapsedFilterNodes);
  }

  protected async buildOrganizationTree(
    orgs: Organization[],
    singleOrgPolicy: boolean,
    personalOwnershipPolicy: boolean,
  ): Promise<TreeNode<OrganizationFilter>> {
    const headNode = this.getOrganizationFilterHead();
    if (!personalOwnershipPolicy) {
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

  protected buildCollectionTree(collections?: CollectionView[]): TreeNode<CollectionFilter> {
    const headNode = this.getCollectionFilterHead();
    if (!collections) {
      return headNode;
    }
    const nodes: TreeNode<CollectionFilter>[] = [];
    collections
      .sort((a, b) => this.i18nService.collator.compare(a.name, b.name))
      .forEach((c) => {
        const collectionCopy = new CollectionView() as CollectionFilter;
        collectionCopy.id = c.id;
        collectionCopy.organizationId = c.organizationId;
        collectionCopy.icon = "bwi-collection";
        if (c instanceof CollectionAdminView) {
          collectionCopy.groups = c.groups;
          collectionCopy.assigned = c.assigned;
        }
        const parts =
          c.name != null ? c.name.replace(/^\/+|\/+$/g, "").split(NestingDelimiter) : [];
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
    ciphers: CipherView[],
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
