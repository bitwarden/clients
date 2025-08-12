import { CommonModule } from "@angular/common";
import { Component, input, output } from "@angular/core";
import { map, shareReplay } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { CIPHER_MENU_ITEMS } from "@bitwarden/common/vault/types/cipher-menu-items";
import { ButtonModule, MenuModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "vault-new-cipher-menu",
  templateUrl: "new-cipher-menu.component.html",
  imports: [ButtonModule, CommonModule, MenuModule, I18nPipe, JslibModule],
})
export class NewCipherMenuComponent {
  canCreateCipher = input(false);
  canCreateFolder = input(false);
  canCreateCollection = input(false);
  canCreateSshKey = input(false);
  folderAdded = output();
  collectionAdded = output();
  cipherAdded = output<CipherType>();

  constructor(private restrictedItemTypesService: RestrictedItemTypesService) {}

  /**
   * Returns an observable that emits the cipher menu items, filtered by the restricted types.
   */
  cipherMenuItems$ = this.restrictedItemTypesService.restricted$.pipe(
    map((restrictedTypes) => {
      return CIPHER_MENU_ITEMS.filter((item) => {
        if (!this.canCreateSshKey() && item.type === CipherType.SshKey) {
          return false;
        }
        return !restrictedTypes.some((restrictedType) => restrictedType.cipherType === item.type);
      });
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}
