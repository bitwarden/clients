import { Directive, HostBinding, HostListener, Input, OnChanges, Optional } from "@angular/core";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { MenuItemDirective } from "@bitwarden/components";
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
  standalone: true,
  selector: "[appCopyField]",
})
export class CopyCipherFieldDirective implements OnChanges {
  @Input({
    alias: "appCopyField",
    required: true,
  })
  action!: Exclude<CopyAction, "hiddenField">;

  @Input({ required: true }) cipher!: CipherView;

  constructor(
    private copyCipherFieldService: CopyCipherFieldService,
    @Optional() private menuItemDirective?: MenuItemDirective,
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
    const value = this.getValueToCopy();
    await this.copyCipherFieldService.copy(value ?? "", this.action, this.cipher);
  }

  async ngOnChanges() {
    await this.updateDisabledState();
  }

  private async updateDisabledState() {
    this.disabled =
      !this.cipher ||
      !this.getValueToCopy() ||
      (this.action === "totp" && !(await this.copyCipherFieldService.totpAllowed(this.cipher)))
        ? true
        : null;

    // If the directive is used on a menu item, update the menu item to prevent keyboard navigation
    if (this.menuItemDirective) {
      this.menuItemDirective.disabled = this.disabled ?? false;
    }
  }

  private getValueToCopy() {
    switch (this.action) {
      case "username":
        return this.cipher.login?.username || this.cipher.identity?.username;
      case "password":
        return this.cipher.login?.password;
      case "totp":
        return this.cipher.login?.totp;
      case "cardNumber":
        return this.cipher.card?.number;
      case "securityCode":
        return this.cipher.card?.code;
      case "email":
        return this.cipher.identity?.email;
      case "phone":
        return this.cipher.identity?.phone;
      case "address":
        return this.cipher.identity?.fullAddressForCopy;
      case "secureNote":
        return this.cipher.notes;
      case "privateKey":
        return this.cipher.sshKey?.privateKey;
      case "publicKey":
        return this.cipher.sshKey?.publicKey;
      case "keyFingerprint":
        return this.cipher.sshKey?.keyFingerprint;
      default:
        return null;
    }
  }
}
