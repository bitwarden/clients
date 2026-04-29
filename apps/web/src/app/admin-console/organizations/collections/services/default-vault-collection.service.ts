import { DestroyRef, inject, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { combineLatest, Observable, shareReplay } from "rxjs";
import { concatMap, filter, map, switchMap } from "rxjs/operators";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { SearchPipe } from "@bitwarden/angular/pipes/search.pipe";
import {
  CollectionAdminView,
  Unassigned,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import {
  getFlatCollectionTree,
  getNestedCollectionTree,
} from "@bitwarden/common/admin-console/utils";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, UserId } from "@bitwarden/common/types/guid";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import { All, RoutedVaultFilterModel } from "@bitwarden/vault";

import { AddAccessStatusType, VaultCollectionService } from "./vault-collection.service";

@Injectable()
export class DefaultVaultCollectionService extends VaultCollectionService {
  private readonly collectionAdminService = inject(CollectionAdminService);
  private readonly i18nService = inject(I18nService);
  private readonly searchService = inject(SearchService);
  private readonly searchPipe = inject(SearchPipe);
  private readonly destroyRef = inject(DestroyRef);

  allCollectionsWithoutUnassigned$!: Observable<CollectionAdminView[]>;
  allCollections$!: Observable<CollectionAdminView[]>;
  editableCollections$!: Observable<CollectionAdminView[]>;
  collections$!: Observable<CollectionAdminView[]>;
  selectedCollection$!: Observable<TreeNode<CollectionAdminView> | undefined>;
  showCollectionAccessRestricted$!: Observable<boolean>;
  showAddAccessToggle$!: Observable<boolean>;

  private nestedCollections$!: Observable<TreeNode<CollectionAdminView>[]>;

  init(
    organization$: Observable<Organization>,
    userId$: Observable<UserId>,
    filter$: Observable<RoutedVaultFilterModel>,
    currentSearchText$: Observable<string>,
    addAccessStatus$: Observable<AddAccessStatusType>,
    refreshingSubject$: Observable<boolean>,
  ): void {
    const organizationId$ = organization$.pipe(map((org) => org.id));

    this.allCollectionsWithoutUnassigned$ = refreshingSubject$.pipe(
      filter((refreshing) => refreshing),
      switchMap(() => combineLatest([organizationId$, userId$])),
      switchMap(([orgId, userId]) =>
        this.collectionAdminService.collectionAdminViews$(orgId, userId),
      ),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.allCollections$ = combineLatest([
      organizationId$,
      this.allCollectionsWithoutUnassigned$,
    ]).pipe(
      map(([orgId, allCollections]) => {
        // FIXME: We should not assert that the Unassigned type is a CollectionId.
        // Instead we should consider representing the Unassigned collection as a different object, given that
        // it is not actually a collection.
        const noneCollection = new CollectionAdminView({
          name: this.i18nService.t("unassigned"),
          id: Unassigned as CollectionId,
          organizationId: orgId,
        });
        return allCollections.concat(noneCollection);
      }),
    );

    this.nestedCollections$ = this.allCollections$.pipe(
      map((collections) => getNestedCollectionTree(collections)),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.editableCollections$ = combineLatest([
      this.allCollectionsWithoutUnassigned$,
      organization$,
    ]).pipe(
      map(([collections, organization]) => {
        // Users that can edit all ciphers can implicitly add to / edit within any collection
        if (organization.canEditAllCiphers) {
          return collections;
        }
        return collections.filter((c) => c.assigned);
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.selectedCollection$ = combineLatest([this.nestedCollections$, filter$]).pipe(
      filter(([collections, f]) => collections != undefined && f != undefined),
      map(([collections, f]) => {
        if (
          f.collectionId === undefined ||
          f.collectionId === All ||
          f.collectionId === Unassigned
        ) {
          return undefined;
        }
        return ServiceUtils.getTreeNodeObjectFromList(collections, f.collectionId);
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.showCollectionAccessRestricted$ = combineLatest([
      filter$,
      this.selectedCollection$,
      organization$,
    ]).pipe(
      map(([f, collection, organization]) => {
        return (
          (f.collectionId === Unassigned && !organization.canEditUnassignedCiphers) ||
          (!organization.canEditAllCiphers && collection != undefined && !collection.node.assigned)
        );
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    // A single shared stream that computes both the visible collections list and whether the
    // "Add Access" toggle should be shown, avoiding two separate async pipelines.
    const collectionsState$ = combineLatest([
      this.nestedCollections$,
      filter$,
      currentSearchText$,
      addAccessStatus$,
      userId$,
      organization$,
    ]).pipe(
      filter(([collections, f]) => collections != undefined && f != undefined),
      concatMap(async ([collections, f, searchText, addAccessStatus, , organization]) => {
        if (
          f.collectionId === Unassigned ||
          (f.collectionId === undefined && f.type !== undefined)
        ) {
          return { collections: [] as CollectionAdminView[], showAddAccessToggle: false };
        }

        let searchableCollectionNodes: TreeNode<CollectionAdminView>[] = [];
        if (f.collectionId === undefined || f.collectionId === All) {
          searchableCollectionNodes = collections;
        } else {
          const selectedCollection = ServiceUtils.getTreeNodeObjectFromList(
            collections,
            f.collectionId,
          );
          searchableCollectionNodes = selectedCollection?.children ?? [];
        }

        let collectionsToReturn: CollectionAdminView[] = [];

        if (await this.searchService.isSearchable(searchText)) {
          // Flatten the tree for searching through all levels
          const flatCollectionTree: CollectionAdminView[] =
            getFlatCollectionTree(searchableCollectionNodes);

          collectionsToReturn = this.searchPipe.transform(
            flatCollectionTree,
            searchText,
            (collection) => collection.name,
            (collection) => collection.id,
          );
        } else {
          collectionsToReturn = searchableCollectionNodes.map(
            (treeNode: TreeNode<CollectionAdminView>): CollectionAdminView => treeNode.node,
          );
        }

        // Toggle is only shown when allowAdminAccessToAllCollectionItems is false and there are
        // unmanaged collections the user can edit.
        const showAddAccessToggle =
          !organization.allowAdminAccessToAllCollectionItems &&
          organization.canEditUnmanagedCollections &&
          collectionsToReturn.some((c) => c.unmanaged);

        if (addAccessStatus === AddAccessStatusType.AddAccess && showAddAccessToggle) {
          collectionsToReturn = collectionsToReturn.filter((c) => c.unmanaged);
        }

        return { collections: collectionsToReturn, showAddAccessToggle };
      }),
      takeUntilDestroyed(this.destroyRef),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.collections$ = collectionsState$.pipe(map((s) => s.collections));
    this.showAddAccessToggle$ = collectionsState$.pipe(map((s) => s.showAddAccessToggle));
  }
}
