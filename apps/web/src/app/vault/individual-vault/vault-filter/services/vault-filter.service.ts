import { Injectable } from "@angular/core";
import {
  BehaviorSubject,
  combineLatestWith,
  firstValueFrom,
  map,
  Observable,
  of,
  ReplaySubject,
  switchMap,
} from "rxjs";

import { CollectionService } from "@bitwarden/common/abstractions/collection.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import {
  isNotProviderUser,
  OrganizationService,
} from "@bitwarden/common/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/abstractions/policy/policy.service.abstraction";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { PolicyType } from "@bitwarden/common/enums/policyType";
import { ServiceUtils } from "@bitwarden/common/misc/serviceUtils";
import { Organization } from "@bitwarden/common/models/domain/organization";
import { TreeNode } from "@bitwarden/common/models/domain/tree-node";
import { CollectionView } from "@bitwarden/common/models/view/collection.view";
import { Guid } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { CollectionAdminView } from "../../../../organizations/core";
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
  protected _collapsedFilterNodes = new BehaviorSubject<Set<string>>(null);
  collapsedFilterNodes$: Observable<Set<string>> = this._collapsedFilterNodes.pipe(
    switchMap(async (nodes) => nodes ?? (await this.getCollapsedFilterNodes()))
  );

  organizationTree$: Observable<TreeNode<OrganizationFilter>> =
    this.organizationService.organizations$.pipe(
      switchMap((orgs) => this.buildOrganizationTree(orgs))
    );

  protected _organizationFilter = new BehaviorSubject<Organization>(null);

  filteredFolders$: Observable<FolderView[]> = this.folderService.folderViews$.pipe(
    combineLatestWith(this._organizationFilter),
    switchMap(([folders, org]) => {
      return this.filterFolders(folders, org);
    })
  );
  folderTree$: Observable<TreeNode<FolderFilter>> = this.filteredFolders$.pipe(
    map((folders) => this.buildFolderTree(folders))
  );

  // TODO: Remove once collections is refactored with observables
  // replace with collection service observable
  private collectionViews$ = new ReplaySubject<CollectionView[]>(1);
  filteredCollections$: Observable<CollectionView[]> = this.collectionViews$.pipe(
    combineLatestWith(this._organizationFilter),
    switchMap(([collections, org]) => {
      return this.filterCollections(collections, org);
    })
  );
  collectionTree$: Observable<TreeNode<CollectionFilter>> = this.filteredCollections$.pipe(
    map((collections) => this.buildCollectionTree(collections))
  );

  cipherTypeTree$: Observable<TreeNode<CipherTypeFilter>> = this.buildCipherTypeTree();

  constructor(
    protected stateService: StateService,
    protected organizationService: OrganizationService,
    protected folderService: FolderService,
    protected cipherService: CipherService,
    protected collectionService: CollectionService,
    protected policyService: PolicyService,
    protected i18nService: I18nService
  ) {}

  // TODO: Remove once collections is refactored with observables
  async reloadCollections() {
    this.collectionViews$.next(await this.collectionService.getAllDecrypted());
  }

  async getCollectionNodeFromTree(id: string) {
    const collections = await firstValueFrom(this.collectionTree$);
    return ServiceUtils.getTreeNodeObject(collections, id) as TreeNode<CollectionFilter>;
  }

  async setCollapsedFilterNodes(collapsedFilterNodes: Set<string>): Promise<void> {
    await this.stateService.setCollapsedGroupings(Array.from(collapsedFilterNodes));
    this._collapsedFilterNodes.next(collapsedFilterNodes);
  }

  protected async getCollapsedFilterNodes(): Promise<Set<string>> {
    const nodes = new Set(await this.stateService.getCollapsedGroupings());
    return nodes;
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
    orgs?: Organization[]
  ): Promise<TreeNode<OrganizationFilter>> {
    const headNode = this.getOrganizationFilterHead();
    if (!(await this.policyService.policyAppliesToUser(PolicyType.PersonalOwnership))) {
      const myVaultNode = this.getOrganizationFilterMyVault();
      headNode.children.push(myVaultNode);
    }
    if (await this.policyService.policyAppliesToUser(PolicyType.SingleOrg)) {
      orgs = orgs.slice(0, 1);
    }
    if (orgs) {
      orgs.filter(isNotProviderUser).forEach((org) => {
        const orgCopy = org as OrganizationFilter;
        orgCopy.icon = "bwi-business";
        const node = new TreeNode<OrganizationFilter>(orgCopy, headNode, orgCopy.name);
        headNode.children.push(node);
      });
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
    myVault.id = "MyVault" as Guid;
    myVault.icon = "bwi-user";
    myVault.enabled = true;
    myVault.hideOptions = true;
    return new TreeNode<OrganizationFilter>(myVault, null, this.i18nService.t("myVault"));
  }

  buildTypeTree(
    head: CipherTypeFilter,
    array?: CipherTypeFilter[]
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
    org?: Organization
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
    org?: Organization
  ): Promise<FolderView[]> {
    // If no org or "My Vault" is selected, show all folders
    if (org?.id == null || org?.id == "MyVault") {
      return storedFolders;
    }

    // Otherwise, show only folders that have ciphers from the selected org and the "no folder" folder
    const ciphers = await this.cipherService.getAllDecrypted();
    const orgCiphers = ciphers.filter((c) => c.organizationId == org?.id);
    return storedFolders.filter(
      (f) => orgCiphers.some((oc) => oc.folderId == f.id) || f.id == null
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
    ];

    return this.buildTypeTree(
      { id: "AllItems", name: "allItems", type: "all", icon: "" },
      allTypeFilters
    );
  }
}
