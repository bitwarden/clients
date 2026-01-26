import { CommonModule } from "@angular/common";
import { Component, input, output } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { combineLatest, map, shareReplay } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { CIPHER_MENU_ITEMS } from "@bitwarden/common/vault/types/cipher-menu-items";
import { ButtonModule, MenuModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-new-cipher-menu",
  templateUrl: "new-cipher-menu.component.html",
  imports: [ButtonModule, CommonModule, MenuModule, I18nPipe, JslibModule],
})
export class NewCipherMenuComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  canCreateCipher = input(false);
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  canCreateFolder = input(false);
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  canCreateCollection = input(false);
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  canCreateSshKey = input(false);
  folderAdded = output();
  collectionAdded = output();
  cipherAdded = output<CipherType>();

  constructor(private restrictedItemTypesService: RestrictedItemTypesService) {}

  /**
   * Returns an observable that emits the cipher menu items, filtered by the restricted types.
   */
  cipherMenuItems$ = combineLatest([
    this.restrictedItemTypesService.restricted$,
    toObservable(this.canCreateCipher),
    toObservable(this.canCreateSshKey),
  ]).pipe(
    map(([restrictedTypes, canCreateCipher, canCreateSshKey]) => {
      // If user cannot create ciphers at all, return empty array
      if (!canCreateCipher) {
        return [];
      }
      return CIPHER_MENU_ITEMS.filter((item) => {
        if (!canCreateSshKey && item.type === CipherType.SshKey) {
          return false;
        }
        return !restrictedTypes.some((restrictedType) => restrictedType.cipherType === item.type);
      });
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /**
   * Returns the appropriate button label based on what can be created.
   * If only collections can be created (no ciphers or folders), show "New Collection".
   * Otherwise, show "New".
   */
  protected getButtonLabel(): string {
    const canCreateCipher = this.canCreateCipher();
    const canCreateFolder = this.canCreateFolder();
    const canCreateCollection = this.canCreateCollection();

    // If only collections can be created, be specific
    if (!canCreateCipher && !canCreateFolder && canCreateCollection) {
      return "newCollection";
    }

    return "new";
  }

  /**
   * Returns true if only collections can be created (no other options).
   * When this is true, the button should directly create a collection instead of showing a dropdown.
   */
  protected isOnlyCollectionCreation(): boolean {
    return !this.canCreateCipher() && !this.canCreateFolder() && this.canCreateCollection();
  }

  /**
   * Handles the button click. If only collections can be created, directly emit the collection event.
   * Otherwise, the menu trigger will handle opening the dropdown.
   */
  protected handleButtonClick(): void {
    if (this.isOnlyCollectionCreation()) {
      this.collectionAdded.emit();
    }
  }
}
