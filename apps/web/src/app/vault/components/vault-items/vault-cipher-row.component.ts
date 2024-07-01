import { Component, EventEmitter, Input, Output } from "@angular/core";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";

import { VaultItemEvent } from "./vault-item-event";
import { RowHeightClass } from "./vault-items.component";

@Component({
  selector: "tr[appVaultCipherRow]",
  templateUrl: "vault-cipher-row.component.html",
})
export class VaultCipherRowComponent {
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
  @Input() vaultBulkManagementActionEnabled: boolean;

  @Output() onEvent = new EventEmitter<VaultItemEvent>();

  @Input() checked: boolean;
  @Output() checkedToggled = new EventEmitter<void>();

  protected CipherType = CipherType;

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
    return this.canEditCipher && !this.cipher.isDeleted;
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
    return (
      !(
        this.isNotDeletedLoginCipher ||
        this.showCopyPassword ||
        this.showCopyTotp ||
        this.showLaunchUri ||
        this.showAttachments ||
        this.showClone ||
        this.canEditCipher ||
        this.cipher.isDeleted
      ) && this.vaultBulkManagementActionEnabled
    );
  }

  protected copy(field: "username" | "password" | "totp") {
    this.onEvent.emit({ type: "copyField", item: this.cipher, field });
  }

  protected clone() {
    this.onEvent.emit({ type: "clone", item: this.cipher });
  }

  protected moveToOrganization() {
    this.onEvent.emit({ type: "moveToOrganization", items: [this.cipher] });
  }

  protected editCollections() {
    this.onEvent.emit({ type: "viewCipherCollections", item: this.cipher });
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
}
