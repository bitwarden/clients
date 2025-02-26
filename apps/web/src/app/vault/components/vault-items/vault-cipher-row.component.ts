// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";

import { CollectionView } from "@bitwarden/admin-console/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  convertToPermission,
  getPermissionList,
} from "./../../../admin-console/organizations/shared/components/access-selector/access-selector.models";
import { VaultItemEvent } from "./vault-item-event";
import { RowHeightClass } from "./vault-items.component";

@Component({
  selector: "tr[appVaultCipherRow]",
  templateUrl: "vault-cipher-row.component.html",
})
export class VaultCipherRowComponent implements OnInit {
  protected RowHeightClass = RowHeightClass;

  @Input() disabled: boolean;
  @Input() cipher: CipherView;
  @Input() showOwner: boolean;
  @Input() showCollections: boolean;
  @Input() showGroups: boolean;
  @Input() showPremiumFeatures: boolean;
  @Input() useEvents: boolean;
  @Input() cloneable: boolean;
  @Input() organizations: Organization[];
  @Input() collections: CollectionView[];
  @Input() viewingOrgVault: boolean;
  @Input() canEditCipher: boolean;
  @Input() canAssignCollections: boolean;
  @Input() canManageCollection: boolean;

  @Output() onEvent = new EventEmitter<VaultItemEvent>();

  @Input() checked: boolean;
  @Output() checkedToggled = new EventEmitter<void>();

  protected CipherType = CipherType;
  private permissionList = getPermissionList();
  private permissionPriority = [
    "manageCollection",
    "editItems",
    "editItemsHidePass",
    "viewItems",
    "viewItemsHidePass",
  ];
  protected organization?: Organization;

  constructor(private i18nService: I18nService) {}

  /**
   * Lifecycle hook for component initialization.
   */
  async ngOnInit(): Promise<void> {
    if (this.cipher.organizationId != null) {
      this.organization = this.organizations.find((o) => o.id === this.cipher.organizationId);
    }
  }

  protected get clickAction() {
    if (this.cipher.decryptionFailure) {
      return "showFailedToDecrypt";
    }
    return "view";
  }

  protected get showTotpCopyButton() {
    return (
      (this.cipher.login?.hasTotp ?? false) &&
      (this.cipher.organizationUseTotp || this.showPremiumFeatures)
    );
  }

  protected get showFixOldAttachments() {
    return this.cipher.hasOldAttachments && this.cipher.organizationId == null;
  }

  protected get showAttachments() {
    return this.canEditCipher || this.cipher.attachments?.length > 0;
  }

  protected get showAssignToCollections() {
    return this.organizations?.length && this.canAssignCollections && !this.cipher.isDeleted;
  }

  protected get showClone() {
    return this.cloneable && !this.cipher.isDeleted;
  }

  protected get showEventLogs() {
    return this.useEvents && this.cipher.organizationId;
  }

  protected get isNotDeletedLoginCipher() {
    return this.cipher.type === this.CipherType.Login && !this.cipher.isDeleted;
  }

  protected get permissionText() {
    if (!this.cipher.organizationId || this.cipher.collectionIds.length === 0) {
      return this.i18nService.t("manageCollection");
    }

    const filteredCollections = this.collections.filter((collection) => {
      if (collection.assigned) {
        return this.cipher.collectionIds.find((id) => {
          if (collection.id === id) {
            return collection;
          }
        });
      }
    });

    if (filteredCollections?.length === 1) {
      return this.i18nService.t(
        this.permissionList.find((p) => p.perm === convertToPermission(filteredCollections[0]))
          ?.labelId,
      );
    }

    if (filteredCollections?.length > 1) {
      const labels = filteredCollections.map((collection) => {
        return this.permissionList.find((p) => p.perm === convertToPermission(collection))?.labelId;
      });

      const highestPerm = this.permissionPriority.find((perm) => labels.includes(perm));
      return this.i18nService.t(highestPerm);
    }

    return this.i18nService.t("noAccess");
  }

  protected get showCopyPassword(): boolean {
    return this.isNotDeletedLoginCipher && this.cipher.viewPassword;
  }

  protected get showCopyTotp(): boolean {
    return this.isNotDeletedLoginCipher && this.showTotpCopyButton;
  }

  protected get showLaunchUri(): boolean {
    return this.isNotDeletedLoginCipher && this.cipher.login.canLaunch;
  }

  protected get disableMenu() {
    return !(
      this.isNotDeletedLoginCipher ||
      this.showCopyPassword ||
      this.showCopyTotp ||
      this.showLaunchUri ||
      this.showAttachments ||
      this.showClone ||
      this.canEditCipher ||
      this.cipher.isDeleted
    );
  }

  protected copy(field: "username" | "password" | "totp") {
    this.onEvent.emit({ type: "copyField", item: this.cipher, field });
  }

  protected clone() {
    this.onEvent.emit({ type: "clone", item: this.cipher });
  }

  protected events() {
    this.onEvent.emit({ type: "viewEvents", item: this.cipher });
  }

  protected restore() {
    this.onEvent.emit({ type: "restore", items: [this.cipher] });
  }

  protected deleteCipher() {
    this.onEvent.emit({ type: "delete", items: [{ cipher: this.cipher }] });
  }

  protected attachments() {
    this.onEvent.emit({ type: "viewAttachments", item: this.cipher });
  }

  protected assignToCollections() {
    this.onEvent.emit({ type: "assignToCollections", items: [this.cipher] });
  }

  protected get showCheckbox() {
    if (!this.viewingOrgVault || !this.organization) {
      return true; // Always show checkbox in individual vault or for non-org items
    }

    return this.organization.canEditAllCiphers || (this.cipher.edit && this.cipher.viewPassword);
  }
}
