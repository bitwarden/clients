import { Component, EventEmitter, Input, Output } from "@angular/core";
import { map, shareReplay } from "rxjs";

import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { CIPHER_MENU_ITEMS } from "@bitwarden/common/vault/types/cipher-menu-items";
import { I18nPipe } from "@bitwarden/ui-common";

import { A11yTitleDirective } from "../a11y";
import { ButtonModule } from "../button";
import { SharedModule } from "../shared";

import { MenuDividerComponent } from "./menu-divider.component";
import { MenuItemDirective } from "./menu-item.directive";
import { MenuTriggerForDirective } from "./menu-trigger-for.directive";
import { MenuComponent } from "./menu.component";

@Component({
  selector: "bit-new-cipher-menu",
  templateUrl: "new-cipher-menu.component.html",
  standalone: true,
  imports: [
    A11yTitleDirective,
    ButtonModule,
    MenuDividerComponent,
    MenuComponent,
    MenuDividerComponent,
    MenuItemDirective,
    MenuTriggerForDirective,
    I18nPipe,
    SharedModule,
  ],
})
export class NewCipherMenu {
  @Input() canCreateCipher = false;
  @Input() canCreateFolder = false;
  @Input() canCreateCollection = false;
  @Output() folderAdded = new EventEmitter<void>();
  @Output() collectionAdded = new EventEmitter<void>();
  @Output() cipherAdded = new EventEmitter<CipherType>();

  constructor(private restrictedItemTypesService: RestrictedItemTypesService) {}

  /**
   * Returns an observable that emits the cipher menu items, filtered by the restricted types.
   */
  cipherMenuItems$ = this.restrictedItemTypesService.restricted$.pipe(
    map((restrictedTypes) => {
      return CIPHER_MENU_ITEMS.filter((item) => {
        return !restrictedTypes.some((restrictedType) => restrictedType.cipherType === item.type);
      });
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}
