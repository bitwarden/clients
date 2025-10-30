// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, EventEmitter, HostListener, Input, Output, ViewChild } from "@angular/core";

import {
  CollectionAdminView,
  Unassigned,
  CollectionView,
  CollectionTypes,
} from "@bitwarden/admin-console/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { MenuTriggerForDirective } from "@bitwarden/components";

import { GroupView } from "../../../admin-console/organizations/core";

import {
  CollectionPermission,
  convertToPermission,
  getPermissionList,
} from "./../../../admin-console/organizations/shared/components/access-selector/access-selector.models";
import { VaultItemEvent } from "./vault-item-event";
import { RowHeightClass } from "./vault-items.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tr[appVaultCollectionRow]",
  templateUrl: "vault-collection-row.component.html",
  standalone: false,
})
export class VaultCollectionRowComponent<C extends CipherViewLike> {
  protected RowHeightClass = RowHeightClass;
  protected Unassigned = "unassigned";
  protected CollectionPermission = CollectionPermission;
  protected DefaultCollectionType = CollectionTypes.DefaultUserCollection;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(MenuTriggerForDirective, { static: false }) menuTrigger: MenuTriggerForDirective;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() disabled: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() collection: CollectionView;
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
  @Input() canEditCollection: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() canDeleteCollection: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() canViewCollectionInfo: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() organizations: Organization[];
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() groups: GroupView[];
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showPermissionsColumn: boolean;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onEvent = new EventEmitter<VaultItemEvent<C>>();

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() checked: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
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

  protected addAccess(initialPermission: CollectionPermission) {
    this.onEvent.next({
      type: "viewCollectionAccess",
      item: this.collection,
      readonly: false,
      initialPermission,
    });
  }

  protected deleteCollection() {
    this.onEvent.next({ type: "delete", items: [{ collection: this.collection }] });
  }

  @HostListener("contextmenu", ["$event"])
  protected onRightClick(event: MouseEvent) {
    if (event.shiftKey && event.ctrlKey) {
      return;
    }

    if (!this.disabled && this.menuTrigger) {
      this.menuTrigger.toggleMenuOnRightClick(event);
    }
  }
}
