import { SelectionModel } from "@angular/cdk/collections";
import { Component, EventEmitter, inject, Input, Output } from "@angular/core";

import { Unassigned, CollectionView, CollectionAdminView } from "@bitwarden/admin-console/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { TableDataSource } from "@bitwarden/components";

import { GroupView } from "../../../admin-console/organizations/core";

import {
  CollectionPermission,
  convertToPermission,
} from "./../../../admin-console/organizations/shared/components/access-selector/access-selector.models";
import { VaultItem } from "./vault-item";
import { VaultItemEvent } from "./vault-item-event";

// Fixed manual row height required due to how cdk-virtual-scroll works
export const RowHeight = 65;
export const RowHeightClass = `tw-h-[65px]`;

const MaxSelectionCount = 500;

@Component({
  selector: "app-vault-items",
  templateUrl: "vault-items.component.html",
  // TODO: Improve change detection, see: https://bitwarden.atlassian.net/browse/TDL-220
  // changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VaultItemsComponent {
  protected i18nService = inject(I18nService);
  protected RowHeight = RowHeight;

  @Input() disabled: boolean;
  @Input() showOwner: boolean;
  @Input() showCollections: boolean;
  @Input() showGroups: boolean;
  @Input() useEvents: boolean;
  @Input() showPremiumFeatures: boolean;
  @Input() showBulkMove: boolean;
  @Input() showBulkTrashOptions: boolean;
  // Encompasses functionality only available from the organization vault context
  @Input() showAdminActions = false;
  @Input() allOrganizations: Organization[] = [];
  @Input() allCollections: CollectionView[] = [];
  @Input() allGroups: GroupView[] = [];
  @Input() showBulkEditCollectionAccess = false;
  @Input() showBulkAddToCollections = false;
  @Input() showPermissionsColumn = false;
  @Input() viewingOrgVault: boolean;
  @Input() addAccessStatus: number;
  @Input() addAccessToggle: boolean;

  private _ciphers?: CipherView[] = [];
  @Input() get ciphers(): CipherView[] {
    return this._ciphers;
  }
  set ciphers(value: CipherView[] | undefined) {
    this._ciphers = value ?? [];
    this.refreshItems();
  }

  private _collections?: CollectionView[] = [];
  @Input() get collections(): CollectionView[] {
    return this._collections;
  }
  set collections(value: CollectionView[] | undefined) {
    this._collections = value ?? [];
    this.refreshItems();
  }

  @Output() onEvent = new EventEmitter<VaultItemEvent>();

  protected editableItems: VaultItem[] = [];
  protected dataSource = new TableDataSource<VaultItem>();
  protected selection = new SelectionModel<VaultItem>(true, [], true);

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

  get disableMenu() {
    return (
      !this.bulkMoveAllowed &&
      !this.showAssignToCollections() &&
      !this.showDelete() &&
      !this.showBulkEditCollectionAccess
    );
  }

  get bulkAssignToCollectionsAllowed() {
    return this.showBulkAddToCollections && this.ciphers.length > 0;
  }

  protected canEditCollection(collection: CollectionView): boolean {
    // Only allow allow deletion if collection editing is enabled and not deleting "Unassigned"
    if (collection.id === Unassigned) {
      return false;
    }

    const organization = this.allOrganizations.find((o) => o.id === collection.organizationId);

    return collection.canEdit(organization);
  }

  protected canDeleteCollection(collection: CollectionView): boolean {
    // Only allow allow deletion if collection editing is enabled and not deleting "Unassigned"
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

  protected event(event: VaultItemEvent) {
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

  protected canClone(vaultItem: VaultItem) {
    if (vaultItem.cipher.organizationId == null) {
      return true;
    }

    const org = this.allOrganizations.find((o) => o.id === vaultItem.cipher.organizationId);

    // Admins and custom users can always clone in the Org Vault
    if (this.viewingOrgVault && (org.isAdmin || org.permissions.editAnyCollection)) {
      return true;
    }

    // Check if the cipher belongs to a collection with canManage permission
    const orgCollections = this.allCollections.filter((c) => c.organizationId === org.id);

    for (const collection of orgCollections) {
      if (vaultItem.cipher.collectionIds.includes(collection.id) && collection.manage) {
        return true;
      }
    }

    return false;
  }

  protected canEditCipher(cipher: CipherView) {
    if (cipher.organizationId == null) {
      return true;
    }

    const organization = this.allOrganizations.find((o) => o.id === cipher.organizationId);
    return (organization.canEditAllCiphers && this.viewingOrgVault) || cipher.edit;
  }

  private refreshItems() {
    const collections: VaultItem[] = this.collections.map((collection) => ({ collection }));
    const ciphers: VaultItem[] = this.ciphers.map((cipher) => ({ cipher }));
    let items: VaultItem[] = [].concat(collections).concat(ciphers);

    this.selection.clear();

    // Every item except for the Unassigned collection is selectable, individual bulk actions check the user's permission
    this.editableItems = items.filter(
      (item) =>
        item.cipher !== undefined ||
        (item.collection !== undefined && item.collection.id !== Unassigned),
    );

    // Apply sorting only for organization vault
    if (this.showAdminActions) {
      items = items.sort(this.defaultSort);
    }

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

    if (this.selection.selected.length === 0) {
      return true;
    }

    const hasPersonalItems = this.hasPersonalItems();
    const uniqueCipherOrgIds = this.getUniqueOrganizationIds();

    // Return false if items are from different organizations
    if (uniqueCipherOrgIds.size > 1) {
      return false;
    }

    // If all items are personal, return based on personal items
    if (uniqueCipherOrgIds.size === 0) {
      return hasPersonalItems;
    }

    const [orgId] = uniqueCipherOrgIds;
    const organization = this.allOrganizations.find((o) => o.id === orgId);

    const canEditOrManageAllCiphers = organization?.canEditAllCiphers && this.viewingOrgVault;

    const collectionNotSelected =
      this.selection.selected.filter((item) => item.collection).length === 0;

    return (canEditOrManageAllCiphers || this.allCiphersHaveEditAccess()) && collectionNotSelected;
  }

  protected showDelete(): boolean {
    if (this.selection.selected.length === 0) {
      return true;
    }

    const hasPersonalItems = this.hasPersonalItems();
    const uniqueCipherOrgIds = this.getUniqueOrganizationIds();
    const organizations = Array.from(uniqueCipherOrgIds, (orgId) =>
      this.allOrganizations.find((o) => o.id === orgId),
    );

    const canEditOrManageAllCiphers =
      organizations.length > 0 && organizations.every((org) => org?.canEditAllCiphers);

    const canDeleteCollections = this.selection.selected
      .filter((item) => item.collection)
      .every((item) => item.collection && this.canDeleteCollection(item.collection));

    const userCanDeleteAccess =
      (canEditOrManageAllCiphers || this.allCiphersHaveEditAccess()) && canDeleteCollections;

    if (
      userCanDeleteAccess ||
      (hasPersonalItems && (!uniqueCipherOrgIds.size || userCanDeleteAccess))
    ) {
      return true;
    }

    return false;
  }

  /**
   * Sorts VaultItems, grouping collections before ciphers, and sorting each group alphabetically by name.
   */
  protected sortByName = (a: VaultItem, b: VaultItem) => {
    const getName = (item: VaultItem) => item.collection?.name || item.cipher?.name;

    // First, sort collections before ciphers
    if (a.collection && !b.collection) {
      return -1;
    }
    if (!a.collection && b.collection) {
      return 1;
    }

    return getName(a).localeCompare(getName(b));
  };

  /**
   * Sorts VaultItems based on group names
   */
  protected sortByGroups = (a: VaultItem, b: VaultItem): number => {
    const getGroupNames = (item: VaultItem): string => {
      if (item.collection instanceof CollectionAdminView) {
        return item.collection.groups
          .map((group) => this.getGroupName(group.id))
          .filter(Boolean)
          .join(",");
      }

      return "";
    };

    const aGroupNames = getGroupNames(a);
    const bGroupNames = getGroupNames(b);

    if (aGroupNames.length !== bGroupNames.length) {
      return bGroupNames.length - aGroupNames.length;
    }

    return aGroupNames.localeCompare(bGroupNames);
  };

  /**
   * Sorts VaultItems based on their permissions, with higher permissions taking precedence.
   * If permissions are equal, it falls back to sorting by name.
   */
  protected sortByPermissions = (a: VaultItem, b: VaultItem): number => {
    const getPermissionPriority = (item: VaultItem): number => {
      if (item.collection instanceof CollectionAdminView) {
        const permission = this.getCollectionPermission(item.collection);

        switch (permission) {
          case CollectionPermission.Manage:
            return 5;
          case CollectionPermission.Edit:
            return 4;
          case CollectionPermission.EditExceptPass:
            return 3;
          case CollectionPermission.View:
            return 2;
          case CollectionPermission.ViewExceptPass:
            return 1;
          case "NoAccess":
            return 0;
        }
      }

      return -1;
    };

    const priorityA = getPermissionPriority(a);
    const priorityB = getPermissionPriority(b);

    // Higher priority first
    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }

    return this.sortByName(a, b);
  };

  /**
   * Default sorting function for vault items.
   * Sorts by: 1. Collections before ciphers
   *           2. Highest permission first
   *           3. Alphabetical order of collections and ciphers
   */
  private defaultSort = (a: VaultItem, b: VaultItem) => {
    // First, sort collections before ciphers
    if (a.collection && !b.collection) {
      return -1;
    }
    if (!a.collection && b.collection) {
      return 1;
    }

    // Next, sort by permissions
    const permissionSort = this.sortByPermissions(a, b);
    if (permissionSort !== 0) {
      return permissionSort;
    }

    // Finally, sort by name
    return this.sortByName(a, b);
  };

  private hasPersonalItems(): boolean {
    return this.selection.selected.some(({ cipher }) => cipher?.organizationId === null);
  }

  private allCiphersHaveEditAccess(): boolean {
    return this.selection.selected
      .filter(({ cipher }) => cipher)
      .every(({ cipher }) => cipher?.edit);
  }

  private getUniqueOrganizationIds(): Set<string> {
    return new Set(this.selection.selected.flatMap((i) => i.cipher?.organizationId ?? []));
  }

  private getGroupName(groupId: string): string | undefined {
    return this.allGroups.find((g) => g.id === groupId)?.name;
  }

  private getCollectionPermission(
    collection: CollectionAdminView,
  ): CollectionPermission | "NoAccess" {
    const organization = this.allOrganizations.find((o) => o.id === collection.organizationId);

    if (collection.id == Unassigned && organization?.canEditUnassignedCiphers) {
      return CollectionPermission.Edit;
    }

    if (collection.assigned) {
      return convertToPermission(collection);
    }

    return "NoAccess";
  }
}
