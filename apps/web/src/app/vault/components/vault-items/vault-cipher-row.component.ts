// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";

import { CollectionView } from "@bitwarden/admin-console/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import {
  convertToPermission,
  getPermissionList,
} from "./../../../admin-console/organizations/shared/components/access-selector/access-selector.models";
import { VaultItemEvent } from "./vault-item-event";
import { RowHeightClass } from "./vault-items.component";

@Component({
  selector: "tr[appVaultCipherRow]",
  templateUrl: "vault-cipher-row.component.html",
  standalone: false,
})
export class VaultCipherRowComponent<C extends CipherViewLike> implements OnInit {
  protected RowHeightClass = RowHeightClass;

  @Input() disabled: boolean;
  @Input() cipher: C;
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
  /**
   * uses new permission delete logic from PM-15493
   */
  @Input() canDeleteCipher: boolean;
  /**
   * uses new permission restore logic from PM-15493
   */
  @Input() canRestoreCipher: boolean;

  @Output() onEvent = new EventEmitter<VaultItemEvent<C>>();

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
    if (this.decryptionFailure) {
      return "showFailedToDecrypt";
    }

    return "view";
  }

  protected get showTotpCopyButton() {
    const login = CipherViewLikeUtils.getLogin(this.cipher);

    const hasTotp = login?.totp ?? false;

    return hasTotp && (this.cipher.organizationUseTotp || this.showPremiumFeatures);
  }

  protected get showFixOldAttachments() {
    return this.cipher.hasOldAttachments && this.cipher.organizationId == null;
  }

  protected get hasAttachments() {
    return CipherViewLikeUtils.hasAttachments(this.cipher);
  }

  protected get showAttachments() {
    return this.canEditCipher || this.hasAttachments;
  }

  protected get canLaunch() {
    return CipherViewLikeUtils.canLaunch(this.cipher);
  }

  protected get launchUri() {
    return CipherViewLikeUtils.getLaunchUri(this.cipher);
  }

  protected get subtitle() {
    return CipherViewLikeUtils.subtitle(this.cipher);
  }

  protected get isDeleted() {
    return CipherViewLikeUtils.isDeleted(this.cipher);
  }

  protected get decryptionFailure() {
    return CipherViewLikeUtils.decryptionFailure(this.cipher);
  }

  protected get showAssignToCollections() {
    return (
      this.organizations?.length &&
      this.canAssignCollections &&
      !CipherViewLikeUtils.isDeleted(this.cipher)
    );
  }

  protected get showShare() {
    return this.organizations?.length && !CipherViewLikeUtils.isDeleted(this.cipher);
  }

  protected get showClone() {
    return this.cloneable && !CipherViewLikeUtils.isDeleted(this.cipher);
  }

  protected get showEventLogs() {
    return this.useEvents && this.cipher.organizationId;
  }

  protected get isNotDeletedLoginCipher() {
    return (
      CipherViewLikeUtils.getType(this.cipher) === this.CipherType.Login &&
      !CipherViewLikeUtils.isDeleted(this.cipher)
    );
  }

  protected get hasPasswordToCopy() {
    return CipherViewLikeUtils.hasCopyableValue(this.cipher, "password");
  }

  protected get hasUsernameToCopy() {
    return CipherViewLikeUtils.hasCopyableValue(this.cipher, "username");
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
    return this.isNotDeletedLoginCipher && this.canLaunch;
  }

  protected get disableMenu() {
    return !(
      this.isNotDeletedLoginCipher ||
      this.showCopyPassword ||
      this.showCopyTotp ||
      this.showLaunchUri ||
      this.showAttachments ||
      this.showClone ||
      this.showShare ||
      this.canEditCipher ||
      (CipherViewLikeUtils.isDeleted(this.cipher) && this.canRestoreCipher)
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

  protected share() {
    this.onEvent.emit({ type: "share", item: this.cipher });
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
