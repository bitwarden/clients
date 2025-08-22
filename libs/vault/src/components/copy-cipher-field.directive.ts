import { Directive, HostBinding, HostListener, Input, OnChanges, Optional } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { MenuItemDirective, BitIconButtonComponent } from "@bitwarden/components";
import { CopyAction, CopyCipherFieldService } from "@bitwarden/vault";

/**
 * Directive to copy a specific field from a cipher on click. Uses the `CopyCipherFieldService` to
 * handle the copying of the field and any necessary password re-prompting or totp generation.
 *
 * Automatically disables the host element if the field to copy is not available or null.
 *
 * If the host element is a menu item, it will be hidden when disabled.
 *
 * @example
 * ```html
 * <button appCopyField="username" [cipher]="cipher">Copy Username</button>
 * ```
 */
@Directive({
  selector: "[appCopyField]",
})
export class CopyCipherFieldDirective implements OnChanges {
  @Input({
    alias: "appCopyField",
    required: true,
  })
  action!: Exclude<CopyAction, "hiddenField">;

  @Input({ required: true }) cipher!: CipherViewLike;

  constructor(
    private copyCipherFieldService: CopyCipherFieldService,
    private accountService: AccountService,
    private cipherService: CipherService,
    @Optional() private menuItemDirective?: MenuItemDirective,
    @Optional() private iconButtonComponent?: BitIconButtonComponent,
  ) {}

  @HostBinding("attr.disabled")
  protected disabled: boolean | null = null;

  /**
   * Hide the element if it is disabled and is a menu item.
   * @private
   */
  @HostBinding("class.tw-hidden")
  private get hidden() {
    return this.disabled && this.menuItemDirective;
  }

  @HostListener("click")
  async copy() {
    const value = await this.getValueToCopy();
    await this.copyCipherFieldService.copy(value ?? "", this.action, this.cipher);
  }

  async ngOnChanges() {
    await this.updateDisabledState();
  }

  private async updateDisabledState() {
    this.disabled =
      !this.cipher ||
      !this.hasValueToCopy() ||
      (this.action === "totp" && !(await this.copyCipherFieldService.totpAllowed(this.cipher)))
        ? true
        : null;

    // When used on an icon button, update the disabled state of the button component
    if (this.iconButtonComponent) {
      this.iconButtonComponent.disabled.set(this.disabled ?? false);
    }

    // If the directive is used on a menu item, update the menu item to prevent keyboard navigation
    if (this.menuItemDirective) {
      this.menuItemDirective.disabled = this.disabled ?? false;
    }
  }

  /** Returns `true` when the cipher has the associated value as populated. */
  private hasValueToCopy() {
    return CipherViewLikeUtils.hasCopyableValue(this.cipher, this.action);
  }

  /** Returns the value of the cipher to be copied. */
  private async getValueToCopy() {
    let _cipher: CipherView;

    if (CipherViewLikeUtils.isCipherListView(this.cipher)) {
      // When the cipher is of type `CipherListView`, the full cipher needs to be decrypted
      const activeAccountId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(getUserId),
      );
      const encryptedCipher = await this.cipherService.get(this.cipher.id!, activeAccountId);
      _cipher = await this.cipherService.decrypt(encryptedCipher, activeAccountId);
    } else {
      _cipher = this.cipher;
    }

    switch (this.action) {
      case "username":
        return _cipher.login?.username || _cipher.identity?.username;
      case "password":
        return _cipher.login?.password;
      case "totp":
        return _cipher.login?.totp;
      case "cardNumber":
        return _cipher.card?.number;
      case "securityCode":
        return _cipher.card?.code;
      case "email":
        return _cipher.identity?.email;
      case "phone":
        return _cipher.identity?.phone;
      case "address":
        return _cipher.identity?.fullAddressForCopy;
      case "secureNote":
        return _cipher.notes;
      case "privateKey":
        return _cipher.sshKey?.privateKey;
      case "publicKey":
        return _cipher.sshKey?.publicKey;
      case "keyFingerprint":
        return _cipher.sshKey?.keyFingerprint;
      default:
        return null;
    }
  }
}
