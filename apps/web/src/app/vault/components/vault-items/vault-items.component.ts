// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SelectionModel } from "@angular/cdk/collections";
import { Component, EventEmitter, Input, Output, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Observable, combineLatest, map, of, switchMap } from "rxjs";

import {
  CollectionAdminView,
  Unassigned,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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
import { VaultBatchBarService, VaultCopyButtonsService, VaultItem } from "@bitwarden/vault";

import { GroupView } from "../../../admin-console/organizations/core";

import {
  CollectionPermission,
  convertToPermission,
} from "./../../../admin-console/organizations/shared/components/access-selector/access-selector.models";
import { VaultItemEvent } from "./vault-item-event";

// Fixed manual row height required due to how cdk-virtual-scroll works
export const RowHeight = 76.5;
export const RowHeightClass = `tw-h-[76.5px]`;

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

  protected readonly batchBarService = inject(VaultBatchBarService) as VaultBatchBarService<C>;

  protected editableItems: VaultItem<C>[] = [];
  protected dataSource = new TableDataSource<VaultItem<C>>();
  get selection(): SelectionModel<VaultItem<C>> {
    return this.batchBarService.selection;
  }
  protected showQuickCopyActions$: Observable<boolean>;
  private restrictedTypes: RestrictedCipherType[] = [];

  private readonly vaultCopyButtonsService = inject(VaultCopyButtonsService);

  constructor(
    protected cipherAuthorizationService: CipherAuthorizationService,
    protected restrictedItemTypesService: RestrictedItemTypesService,
    private configService: ConfigService,
  ) {
    this.showQuickCopyActions$ = combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.PM40435_QuickCopyIconSetting),
      this.vaultCopyButtonsService.showQuickCopyActions$,
    ]).pipe(map(([flagEnabled, settingEnabled]) => flagEnabled && settingEnabled));
    this.restrictedItemTypesService.restricted$.pipe(takeUntilDestroyed()).subscribe((types) => {
      this.restrictedTypes = types;
      this.refreshItems();
    });
  }

  clearSelection() {
    this.selection.clear();
  }

  get showExtraColumn() {
    return this.showCollections || this.showGroups || this.showOwner;
  }

  /**
   * Width of the options column. A row's copy and launch actions are absolutely positioned to the
   * left of its options menu, so the column has to be wide enough to hold them all. Otherwise they
   * render on top of the preceding columns, e.g. the owner badge.
   */
  protected optionsColumnWidthClass(showQuickCopyActions: boolean): string {
    // Quick copy shows an icon per copyable field rather than a single combined copy menu
    return showQuickCopyActions ? "tw-w-48" : "tw-w-32";
  }

  get isAllSelected() {
    // Check selection against sorted items to match toggleAll() behavior
    const sortedItems = this.getSortedEditableItems();
    return sortedItems.slice(0, MaxSelectionCount).every((item) => this.selection.isSelected(item));
  }

  get isEmpty() {
    return this.dataSource.data.length === 0;
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
    if (this.isAllSelected) {
      this.selection.clear();
    } else {
      const sortedItems = this.getSortedEditableItems();
      this.selection.select(...sortedItems.slice(0, MaxSelectionCount));
    }
  }

  /**
   * Returns editableItems sorted according to the current table sort configuration.
   * This ensures bulk selection matches the visual order displayed to the user.
   */
  private getSortedEditableItems(): VaultItem<C>[] {
    const currentSort = this.dataSource.sort;
    const items = [...this.editableItems];

    // If no sort function is set, return items in their original order (as displayed in table)
    if (!currentSort || !currentSort.fn) {
      return items;
    }

    // Apply sort function with direction modifier (matches TableDataSource.sortData behavior)
    const directionModifier = currentSort.direction === "asc" ? 1 : -1;
    return items.sort((a, b) => currentSort.fn(a, b, currentSort.direction) * directionModifier);
  }

  protected event(event: VaultItemEvent<C>) {
    this.onEvent.emit(event);
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
    return (organization?.canEditAllCiphers && this.viewingOrgVault) || cipher.edit;
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

    // Ciphers are selectable only if the user can edit them; collections only if they can be edited or deleted
    this.editableItems = items.filter(
      (item) =>
        (item.cipher !== undefined && this.canEditCipher(item.cipher)) ||
        (item.collection !== undefined &&
          (this.canEditCollection(item.collection) || this.canDeleteCollection(item.collection))),
    );

    this.dataSource.data = items;
  }

  /**
   * Sorts VaultItems, grouping collections before ciphers, and sorting each group alphabetically by name.
   */
  protected sortByName = (a: VaultItem<C>, b: VaultItem<C>, direction: SortDirection) => {
    // Collections before ciphers (direction-independent)
    const collectionCompare = this.prioritizeCollections(a, b);
    if (collectionCompare !== 0) {
      return collectionCompare;
    }

    // Name comparison (direction-dependent, handled by directionModifier)
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

    // Collections before ciphers (direction-independent)
    const collectionCompare = this.prioritizeCollections(a, b);
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

    // Collections before ciphers (direction-independent)
    const collectionCompare = this.prioritizeCollections(a, b);
    if (collectionCompare !== 0) {
      return collectionCompare;
    }

    const priorityA = getPermissionPriority(a);
    const priorityB = getPermissionPriority(b);

    // Higher priority first (direction-dependent, handled by directionModifier)
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // Fallback to name comparison (direction-dependent, handled by directionModifier)
    return this.compareNames(a, b);
  };

  private compareNames(a: VaultItem<C>, b: VaultItem<C>): number {
    const getName = (item: VaultItem<C>) => item.collection?.name || item.cipher?.name;
    return getName(a)?.localeCompare(getName(b)) ?? -1;
  }

  /**
   * Sorts VaultItems by prioritizing collections over ciphers.
   * Always returns -1 for collections before ciphers, regardless of sort direction.
   * This comparison is direction-independent; the direction is applied separately via directionModifier.
   */
  private prioritizeCollections(a: VaultItem<C>, b: VaultItem<C>): number {
    if (a.collection && !b.collection) {
      return -1; // a (collection) comes before b (cipher)
    }

    if (!a.collection && b.collection) {
      return 1; // b (collection) comes before a (cipher)
    }

    return 0; // Both are collections or both are ciphers
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
