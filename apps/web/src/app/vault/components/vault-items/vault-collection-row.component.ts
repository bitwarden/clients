// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, EventEmitter, Input, Output } from "@angular/core";

import { CollectionAdminView, Unassigned, CollectionView } from "@bitwarden/admin-console/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { GroupView } from "../../../admin-console/organizations/core";

import {
  convertToPermission,
  getPermissionList,
} from "./../../../admin-console/organizations/shared/components/access-selector/access-selector.models";
import { VaultItemEvent } from "./vault-item-event";
import { RowHeightClass } from "./vault-items.component";

@Component({
  selector: "tr[appVaultCollectionRow]",
  templateUrl: "vault-collection-row.component.html",
  standalone: false,
})
export class VaultCollectionRowComponent<C extends CipherViewLike> {
  protected RowHeightClass = RowHeightClass;
  protected Unassigned = "unassigned";

  @Input() disabled: boolean;
  @Input() collection: CollectionView;
  @Input() showOwner: boolean;
  @Input() showCollections: boolean;
  @Input() showGroups: boolean;
  @Input() canEditCollection: boolean;
  @Input() canDeleteCollection: boolean;
  @Input() canViewCollectionInfo: boolean;
  @Input() organizations: Organization[];
  @Input() groups: GroupView[];
  @Input() showPermissionsColumn: boolean;

  @Output() onEvent = new EventEmitter<VaultItemEvent<C>>();

  @Input() checked: boolean;
  @Output() checkedToggled = new EventEmitter<void>();

  constructor(private i18nService: I18nService) {}

  get collectionGroups() {
    if (!(this.collection instanceof CollectionAdminView)) {
      return [];
    }

    return this.collection.groups;
  }

  get organization() {
    return this.organizations.find((o) => o.id === this.collection.organizationId);
  }

  get showAddAccess() {
    if (this.collection.id == Unassigned) {
      return false;
    }

    // Only show AddAccess when viewing the Org vault (implied by CollectionAdminView)
    if (this.collection instanceof CollectionAdminView) {
      // Only show AddAccess if unmanaged and allowAdminAccessToAllCollectionItems is disabled
      return (
        !this.organization?.allowAdminAccessToAllCollectionItems &&
        this.collection.unmanaged &&
        this.organization?.canEditUnmanagedCollections
      );
    }

    return false;
  }

  get permissionText() {
    if (this.collection.id == Unassigned && this.organization?.canEditUnassignedCiphers) {
      return this.i18nService.t("editItems");
    }
    if ((this.collection as CollectionAdminView).assigned) {
      const permissionList = getPermissionList();
      return this.i18nService.t(
        permissionList.find((p) => p.perm === convertToPermission(this.collection))?.labelId,
      );
    }
    return this.i18nService.t("noAccess");
  }

  get permissionTooltip() {
    if (this.collection.id == Unassigned) {
      return this.i18nService.t("collectionAdminConsoleManaged");
    }
    return "";
  }

  protected edit(readonly: boolean) {
    this.onEvent.next({ type: "editCollection", item: this.collection, readonly: readonly });
  }

  protected access(readonly: boolean) {
    this.onEvent.next({ type: "viewCollectionAccess", item: this.collection, readonly: readonly });
  }

  protected deleteCollection() {
    this.onEvent.next({ type: "delete", items: [{ collection: this.collection }] });
  }
}
