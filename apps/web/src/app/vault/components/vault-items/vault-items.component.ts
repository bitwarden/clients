// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SelectionModel } from "@angular/cdk/collections";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Observable, combineLatest, map, of, startWith, switchMap } from "rxjs";

import { CollectionView, Unassigned, CollectionAdminView } from "@bitwarden/admin-console/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { SortDirection, TableDataSource } from "@bitwarden/components";
import { OrganizationId } from "@bitwarden/sdk-internal";

import { GroupView } from "../../../admin-console/organizations/core";

import {
  CollectionPermission,
  convertToPermission,
} from "./../../../admin-console/organizations/shared/components/access-selector/access-selector.models";
import { VaultItem } from "./vault-item";
import { VaultItemEvent } from "./vault-item-event";

// Fixed manual row height required due to how cdk-virtual-scroll works
export const RowHeight = 75;
export const RowHeightClass = `tw-h-[75px]`;

const MaxSelectionCount = 500;

type ItemPermission = CollectionPermission | "NoAccess";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-vault-items",
  templateUrl: "vault-items.component.html",
  standalone: false,
})
export class VaultItemsComponent<C extends CipherViewLike> {
  protected RowHeight = RowHeight;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() disabled: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showOwner: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showCollections: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showGroups: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() useEvents: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showPremiumFeatures: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showBulkMove: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showBulkTrashOptions: boolean;
  // Encompasses functionality only available from the organization vault context
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showAdminActions = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() allOrganizations: Organization[] = [];
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() allCollections: CollectionView[] = [];
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() allGroups: GroupView[] = [];
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showBulkEditCollectionAccess = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showBulkAddToCollections = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showPermissionsColumn = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() viewingOrgVault: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() addAccessStatus: number;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() addAccessToggle: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() activeCollection: CollectionView | undefined;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() userCanArchive: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() enforceOrgDataOwnershipPolicy: boolean;

  private _ciphers?: C[] = [];
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() get ciphers(): C[] {
    return this._ciphers;
  }
  set ciphers(value: C[] | undefined) {
    this._ciphers = value ?? [];
    this.refreshItems();
  }

  private _collections?: CollectionView[] = [];
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() get collections(): CollectionView[] {
    return this._collections;
  }
  set collections(value: CollectionView[] | undefined) {
    this._collections = value ?? [];
    this.refreshItems();
  }

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onEvent = new EventEmitter<VaultItemEvent<C>>();

  protected editableItems: VaultItem<C>[] = [];
  protected dataSource = new TableDataSource<VaultItem<C>>();
  protected selection = new SelectionModel<VaultItem<C>>(true, [], true);
  protected canDeleteSelected$: Observable<boolean>;
  protected canRestoreSelected$: Observable<boolean>;
  protected disableMenu$: Observable<boolean>;
  private restrictedTypes: RestrictedCipherType[] = [];

  protected archiveFeatureEnabled$ = this.cipherArchiveService.hasArchiveFlagEnabled$;

  constructor(
    protected cipherAuthorizationService: CipherAuthorizationService,
    protected restrictedItemTypesService: RestrictedItemTypesService,
    protected cipherArchiveService: CipherArchiveService,
  ) {
    this.canDeleteSelected$ = this.selection.changed.pipe(
      startWith(null),
      switchMap(() => {
        const ciphers = this.selection.selected
          .filter((item) => item.cipher)
          .map((item) => item.cipher);

        if (this.selection.selected.length === 0) {
          return of(true);
        }

        const canDeleteCiphers$ = ciphers.map((c) =>
          cipherAuthorizationService.canDeleteCipher$(c, this.showAdminActions),
        );

        const canDeleteCollections = this.selection.selected
          .filter((item) => item.collection)
          .every((item) => item.collection && this.canDeleteCollection(item.collection));

        const canDelete$ = combineLatest(canDeleteCiphers$).pipe(
          map((results) => results.every((item) => item) && canDeleteCollections),
        );

        return canDelete$;
      }),
    );

    this.restrictedItemTypesService.restricted$.pipe(takeUntilDestroyed()).subscribe((types) => {
      this.restrictedTypes = types;
      this.refreshItems();
    });

    this.canRestoreSelected$ = this.selection.changed.pipe(
      startWith(null),
      switchMap(() => {
        const ciphers = this.selection.selected
          .filter((item) => item.cipher)
          .map((item) => item.cipher);

        if (this.selection.selected.length === 0) {
          return of(true);
        }

        const canRestoreCiphers$ = ciphers.map((c) =>
          cipherAuthorizationService.canRestoreCipher$(c, this.showAdminActions),
        );

        const canRestore$ = combineLatest(canRestoreCiphers$).pipe(
          map((results) => results.every((item) => item)),
        );

        return canRestore$;
      }),
      map((canRestore) => canRestore && this.showBulkTrashOptions),
    );

    this.disableMenu$ = this.canDeleteSelected$.pipe(
      map((canDelete) => {
        return (
          !this.bulkMoveAllowed &&
          !this.showAssignToCollections() &&
          !canDelete &&
          !this.showBulkEditCollectionAccess
        );
      }),
    );
  }

  clearSelection() {
    this.selection.clear();
  }

  get showExtraColumn() {
    return this.showCollections || this.showGroups || this.showOwner;
  }

  get isAllSelected() {
    return this.editableItems
      .slice(0, MaxSelectionCount)
      .every((item) => this.selection.isSelected(item));
  }

  get isEmpty() {
    return this.dataSource.data.length === 0;
  }

  get bulkMoveAllowed() {
    return (
      this.showBulkMove && this.selection.selected.filter((item) => item.collection).length === 0
    );
  }

  get bulkArchiveAllowed() {
    if (this.selection.selected.length === 0 || !this.userCanArchive) {
      return false;
    }

    return (
      this.userCanArchive &&
      !this.selection.selected.find(
        (item) => item.cipher && (item.cipher.organizationId || item.cipher.archivedDate),
      )
    );
  }

  // Bulk Unarchive button should appear for Archive vault even if user does not have archive permissions
  get bulkUnarchiveAllowed() {
    if (this.selection.selected.length === 0) {
      return false;
    }

    return !this.selection.selected.find(
      (item) => !item.cipher?.archivedDate || item.cipher?.organizationId,
    );
  }

  //@TODO: remove this function when removing the limitItemDeletion$ feature flag.
  get showDelete(): boolean {
    if (this.selection.selected.length === 0) {
      return true;
    }

    const hasPersonalItems = this.hasPersonalItems();
    const uniqueCipherOrgIds = this.getUniqueOrganizationIds();

    const canManageCollectionCiphers = this.selection.selected
      .filter((item) => item.cipher)
      .every(({ cipher }) => this.canManageCollection(cipher));

    const canDeleteCollections = this.selection.selected
      .filter((item) => item.collection)
      .every((item) => item.collection && this.canDeleteCollection(item.collection));

    const userCanDeleteAccess = canManageCollectionCiphers && canDeleteCollections;

    if (
      userCanDeleteAccess ||
      (hasPersonalItems && (!uniqueCipherOrgIds.size || userCanDeleteAccess))
    ) {
      return true;
    }

    return false;
  }

  get bulkAssignToCollectionsAllowed() {
    return (
      this.showBulkAddToCollections &&
      this.ciphers.length > 0 &&
      !this.anySelectedCiphersAreArchived
    );
  }

  get anySelectedCiphersAreArchived() {
    return this.selection.selected.some(
      (item) => item.cipher && CipherViewLikeUtils.isArchived(item.cipher),
    );
  }

  protected canEditCollection(collection: CollectionView): boolean {
    // Only allow deletion if collection editing is enabled and not deleting "Unassigned"
    if (collection.id === Unassigned) {
      return false;
    }

    const organization = this.allOrganizations.find((o) => o.id === collection.organizationId);

    return collection.canEdit(organization);
  }

  protected canDeleteCollection(collection: CollectionView): boolean {
    // Only allow deletion if collection editing is enabled and not deleting "Unassigned"
    if (collection.id === Unassigned) {
      return false;
    }

    const organization = this.allOrganizations.find((o) => o.id === collection.organizationId);

    return collection.canDelete(organization);
  }

  protected canViewCollectionInfo(collection: CollectionView) {
    const organization = this.allOrganizations.find((o) => o.id === collection.organizationId);
    return collection.canViewCollectionInfo(organization);
  }

  protected toggleAll() {
    this.isAllSelected
      ? this.selection.clear()
      : this.selection.select(...this.editableItems.slice(0, MaxSelectionCount));
  }

  protected event(event: VaultItemEvent<C>) {
    this.onEvent.emit(event);
  }

  protected bulkMoveToFolder() {
    this.event({
      type: "moveToFolder",
      items: this.selection.selected
        .filter((item) => item.cipher !== undefined)
        .map((item) => item.cipher),
    });
  }

  protected bulkArchive() {
    this.event({
      type: "archive",
      items: this.selection.selected
        .filter((item) => item.cipher !== undefined)
        .map((item) => item.cipher),
    });
  }

  protected bulkUnarchive() {
    this.event({
      type: "unarchive",
      items: this.selection.selected
        .filter((item) => item.cipher !== undefined)
        .map((item) => item.cipher),
    });
  }

  protected bulkRestore() {
    this.event({
      type: "restore",
      items: this.selection.selected
        .filter((item) => item.cipher !== undefined)
        .map((item) => item.cipher),
    });
  }

  protected bulkDelete() {
    this.event({
      type: "delete",
      items: this.selection.selected,
    });
  }

  protected canClone$(vaultItem: VaultItem<C>): Observable<boolean> {
    return this.restrictedItemTypesService.restricted$.pipe(
      switchMap((restrictedTypes) => {
        // This will check for restrictions from org policies before allowing cloning.
        const isItemRestricted = restrictedTypes.some(
          (rt) => rt.cipherType === CipherViewLikeUtils.getType(vaultItem.cipher),
        );
        if (isItemRestricted) {
          return of(false);
        }
        return this.cipherAuthorizationService.canCloneCipher$(
          vaultItem.cipher,
          this.showAdminActions,
        );
      }),
    );
  }

  protected canEditCipher(cipher: C) {
    if (cipher.organizationId == null) {
      return true;
    }

    const organization = this.allOrganizations.find((o) => o.id === cipher.organizationId);
    return (organization.canEditAllCiphers && this.viewingOrgVault) || cipher.edit;
  }

  protected canAssignCollections(cipher: C) {
    const organization = this.allOrganizations.find((o) => o.id === cipher.organizationId);
    const editableCollections = this.allCollections.filter((c) => !c.readOnly);

    return (
      (organization?.canEditAllCiphers && this.viewingOrgVault) ||
      (CipherViewLikeUtils.canAssignToCollections(cipher) && editableCollections.length > 0)
    );
  }

  protected canManageCollection(cipher: C) {
    // If the cipher is not part of an organization (personal item), user can manage it
    if (cipher.organizationId == null) {
      return true;
    }

    // Check for admin access in AC vault
    if (this.showAdminActions) {
      const organization = this.allOrganizations.find((o) => o.id === cipher.organizationId);
      // If the user is an admin, they can delete an unassigned cipher
      if (cipher.collectionIds.length === 0) {
        return organization?.canEditUnmanagedCollections === true;
      }

      if (
        organization?.permissions.editAnyCollection ||
        (organization?.allowAdminAccessToAllCollectionItems && organization.isAdmin)
      ) {
        return true;
      }
    }

    if (this.activeCollection) {
      return this.activeCollection.manage === true;
    }

    return this.allCollections
      .filter((c) => cipher.collectionIds.includes(c.id as any))
      .some((collection) => collection.manage);
  }

  private refreshItems() {
    const collections: VaultItem<C>[] = this.collections.map((collection) => ({ collection }));
    const ciphers: VaultItem<C>[] = this.ciphers
      .filter(
        (cipher) =>
          !this.restrictedItemTypesService.isCipherRestricted(cipher, this.restrictedTypes),
      )
      .map((cipher) => ({ cipher }));
    const items: VaultItem<C>[] = [].concat(collections).concat(ciphers);

    // All ciphers are selectable, collections only if they can be edited or deleted
    this.editableItems = items.filter(
      (item) =>
        item.cipher !== undefined ||
        (item.collection !== undefined &&
          (this.canEditCollection(item.collection) || this.canDeleteCollection(item.collection))),
    );

    this.dataSource.data = items;
  }

  protected bulkEditCollectionAccess() {
    this.event({
      type: "bulkEditCollectionAccess",
      items: this.selection.selected
        .filter((item) => item.collection !== undefined)
        .map((item) => item.collection),
    });
  }

  protected assignToCollections() {
    this.event({
      type: "assignToCollections",
      items: this.selection.selected
        .filter((item) => item.cipher !== undefined)
        .map((item) => item.cipher),
    });
  }

  protected showAssignToCollections(): boolean {
    if (!this.showBulkMove) {
      return false;
    }

    // When the user doesn't belong to an organization, hide assign to collections
    if (this.allOrganizations.length === 0) {
      return false;
    }

    if (this.selection.selected.length === 0) {
      return false;
    }

    const hasPersonalItems = this.hasPersonalItems();
    const uniqueCipherOrgIds = this.getUniqueOrganizationIds();
    const hasEditableCollections = this.allCollections.some((collection) => {
      return !collection.readOnly;
    });

    // Return false if items are from different organizations
    if (uniqueCipherOrgIds.size > 1) {
      return false;
    }

    // If all selected items are personal, return based on personal items
    if (uniqueCipherOrgIds.size === 0 && hasEditableCollections) {
      return hasPersonalItems;
    }

    const [orgId] = uniqueCipherOrgIds;
    const organization = this.allOrganizations.find((o) => o.id === orgId);

    const canEditOrManageAllCiphers = organization?.canEditAllCiphers && this.viewingOrgVault;

    const collectionNotSelected =
      this.selection.selected.filter((item) => item.collection).length === 0;

    return (
      (canEditOrManageAllCiphers || this.allCiphersHaveEditAccess()) &&
      collectionNotSelected &&
      hasEditableCollections
    );
  }

  /**
   * Sorts VaultItems, grouping collections before ciphers, and sorting each group alphabetically by name.
   */
  protected sortByName = (a: VaultItem<C>, b: VaultItem<C>, direction: SortDirection) => {
    // Collections before ciphers
    const collectionCompare = this.prioritizeCollections(a, b, direction);
    if (collectionCompare !== 0) {
      return collectionCompare;
    }

    return this.compareNames(a, b);
  };

  /**
   * Sorts VaultItems based on group names
   */
  protected sortByGroups = (a: VaultItem<C>, b: VaultItem<C>, direction: SortDirection) => {
    if (
      !(a.collection instanceof CollectionAdminView) &&
      !(b.collection instanceof CollectionAdminView)
    ) {
      return 0;
    }

    const getFirstGroupName = (collection: CollectionAdminView): string => {
      if (collection.groups.length > 0) {
        return collection.groups.map((group) => this.getGroupName(group.id) || "").sort()[0];
      }
      return null;
    };

    // Collections before ciphers
    const collectionCompare = this.prioritizeCollections(a, b, direction);
    if (collectionCompare !== 0) {
      return collectionCompare;
    }

    const aGroupName = getFirstGroupName(a.collection as CollectionAdminView);
    const bGroupName = getFirstGroupName(b.collection as CollectionAdminView);

    // Collections with groups come before collections without groups.
    // If a collection has no groups, getFirstGroupName returns null.
    if (aGroupName === null) {
      return 1;
    }

    if (bGroupName === null) {
      return -1;
    }

    return aGroupName.localeCompare(bGroupName);
  };

  /**
   * Sorts VaultItems based on their permissions, with higher permissions taking precedence.
   * If permissions are equal, it falls back to sorting by name.
   */
  protected sortByPermissions = (a: VaultItem<C>, b: VaultItem<C>, direction: SortDirection) => {
    const getPermissionPriority = (item: VaultItem<C>): number => {
      const permission = item.collection
        ? this.getCollectionPermission(item.collection)
        : this.getCipherPermission(item.cipher);

      const priorityMap = {
        [CollectionPermission.Manage]: 5,
        [CollectionPermission.Edit]: 4,
        [CollectionPermission.EditExceptPass]: 3,
        [CollectionPermission.View]: 2,
        [CollectionPermission.ViewExceptPass]: 1,
        NoAccess: 0,
      };

      return priorityMap[permission] ?? -1;
    };

    // Collections before ciphers
    const collectionCompare = this.prioritizeCollections(a, b, direction);
    if (collectionCompare !== 0) {
      return collectionCompare;
    }

    const priorityA = getPermissionPriority(a);
    const priorityB = getPermissionPriority(b);

    // Higher priority first
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    return this.compareNames(a, b);
  };

  private compareNames(a: VaultItem<C>, b: VaultItem<C>): number {
    const getName = (item: VaultItem<C>) => item.collection?.name || item.cipher?.name;
    return getName(a)?.localeCompare(getName(b)) ?? -1;
  }

  /**
   * Sorts VaultItems by prioritizing collections over ciphers.
   * Collections are always placed before ciphers, regardless of the sorting direction.
   */
  private prioritizeCollections(
    a: VaultItem<C>,
    b: VaultItem<C>,
    direction: SortDirection,
  ): number {
    if (a.collection && !b.collection) {
      return direction === "asc" ? -1 : 1;
    }

    if (!a.collection && b.collection) {
      return direction === "asc" ? 1 : -1;
    }

    return 0;
  }

  private hasPersonalItems(): boolean {
    return this.selection.selected.some(({ cipher }) => !cipher?.organizationId);
  }

  private allCiphersHaveEditAccess(): boolean {
    return this.selection.selected
      .filter(({ cipher }) => cipher)
      .every(({ cipher }) => cipher?.edit && cipher?.viewPassword);
  }

  private getUniqueOrganizationIds(): Set<string | [] | OrganizationId> {
    return new Set(this.selection.selected.flatMap((i) => i.cipher?.organizationId ?? []));
  }

  private getGroupName(groupId: string): string | undefined {
    return this.allGroups.find((g) => g.id === groupId)?.name;
  }

  private getCollectionPermission(collection: CollectionView): ItemPermission {
    const organization = this.allOrganizations.find((o) => o.id === collection.organizationId);

    if (collection.id == Unassigned && organization?.canEditUnassignedCiphers) {
      return CollectionPermission.Edit;
    }

    if (collection.assigned) {
      return convertToPermission(collection);
    }

    return "NoAccess";
  }

  private getCipherPermission(cipher: C): ItemPermission {
    if (!cipher.organizationId || cipher.collectionIds.length === 0) {
      return CollectionPermission.Manage;
    }

    const filteredCollections = this.allCollections?.filter((collection) => {
      if (collection.assigned) {
        return cipher.collectionIds.find((id) => {
          if (collection.id === id) {
            return collection;
          }
        });
      }
    });

    if (filteredCollections?.length === 1) {
      return convertToPermission(filteredCollections[0]);
    }

    if (filteredCollections?.length > 0) {
      const permissions = filteredCollections.map((collection) => convertToPermission(collection));

      const orderedPermissions = [
        CollectionPermission.Manage,
        CollectionPermission.Edit,
        CollectionPermission.EditExceptPass,
        CollectionPermission.View,
        CollectionPermission.ViewExceptPass,
      ];

      return orderedPermissions.find((perm) => permissions.includes(perm));
    }

    return "NoAccess";
  }
}
