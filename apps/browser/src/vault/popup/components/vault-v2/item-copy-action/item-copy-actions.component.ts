// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input, inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { IconButtonModule, ItemModule, MenuModule } from "@bitwarden/components";
import { CopyCipherFieldDirective } from "@bitwarden/vault";

import { VaultPopupCopyButtonsService } from "../../../services/vault-popup-copy-buttons.service";

@Component({
  standalone: true,
  selector: "app-item-copy-actions",
  templateUrl: "item-copy-actions.component.html",
  imports: [
    ItemModule,
    IconButtonModule,
    JslibModule,
    MenuModule,
    CommonModule,
    CopyCipherFieldDirective,
  ],
})
export class ItemCopyActionsComponent {
  protected showQuickCopyActions$ = inject(VaultPopupCopyButtonsService).showQuickCopyActions$;

  @Input() cipher: CipherView;

  protected CipherType = CipherType;

  get hasLoginValues() {
    return (
      !!this.cipher.login.hasTotp || !!this.cipher.login.password || !!this.cipher.login.username
    );
  }

  get hasCardValues() {
    return !!this.cipher.card.code || !!this.cipher.card.number;
  }

  get hasIdentityValues() {
    return (
      !!this.cipher.identity.fullAddressForCopy ||
      !!this.cipher.identity.email ||
      !!this.cipher.identity.username ||
      !!this.cipher.identity.phone
    );
  }

  get hasSecureNoteValue() {
    return !!this.cipher.notes;
  }

  get hasSshKeyValues() {
    return (
      !!this.cipher.sshKey.privateKey ||
      !!this.cipher.sshKey.publicKey ||
      !!this.cipher.sshKey.keyFingerprint
    );
  }

  constructor() {}
}
