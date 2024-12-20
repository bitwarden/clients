// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import { booleanAttribute, Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BadgeModule,
  ButtonModule,
  CompactModeService,
  DialogService,
  IconButtonModule,
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";
import {
  DecryptionFailureDialogComponent,
  OrgIconDirective,
  PasswordRepromptService,
} from "@bitwarden/vault";

import { BrowserApi } from "../../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../../platform/popup/browser-popup-utils";
import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";
import { PopupCipherView } from "../../../views/popup-cipher.view";
import { ItemCopyActionsComponent } from "../item-copy-action/item-copy-actions.component";
import { ItemMoreOptionsComponent } from "../item-more-options/item-more-options.component";

@Component({
  imports: [
    CommonModule,
    ItemModule,
    ButtonModule,
    BadgeModule,
    IconButtonModule,
    SectionComponent,
    TypographyModule,
    JslibModule,
    SectionHeaderComponent,
    RouterLink,
    ItemCopyActionsComponent,
    ItemMoreOptionsComponent,
    OrgIconDirective,
    ScrollingModule,
    DecryptionFailureDialogComponent,
  ],
  selector: "app-vault-list-items-container",
  templateUrl: "vault-list-items-container.component.html",
  standalone: true,
})
export class VaultListItemsContainerComponent {
  private compactModeService = inject(CompactModeService);

  /**
   * The class used to set the height of a bit item's inner content.
   */
  protected readonly itemHeightClass = `tw-h-[52px]`;

  /**
   * The height of a bit item in pixels. Includes any margin, padding, or border. Used by the virtual scroll
   * to estimate how many items can be displayed at once and how large the virtual container should be.
   * Needs to be updated if the item height or spacing changes.
   *
   * Default: 52px + 1px border + 6px bottom margin = 59px
   *
   * Compact mode: 52px + 1px border = 53px
   */
  protected readonly itemHeight$ = this.compactModeService.enabled$.pipe(
    map((enabled) => (enabled ? 53 : 59)),
  );

  /**
   * Timeout used to add a small delay when selecting a cipher to allow for double click to launch
   * @private
   */
  private viewCipherTimeout: number | null;

  /**
   * The list of ciphers to display.
   */
  @Input()
  ciphers: PopupCipherView[] = [];

  /**
   * Title for the vault list item section.
   */
  @Input()
  title: string;

  /**
   * Optional description for the vault list item section. Will be shown below the title even when
   * no ciphers are available.
   */
  @Input()
  description: string;

  /**
   * Option to show a refresh button in the section header.
   */
  @Input({ transform: booleanAttribute })
  showRefresh: boolean;

  /**
   * Event emitted when the refresh button is clicked.
   */
  @Output()
  onRefresh = new EventEmitter<void>();

  /**
   * Option to show the autofill button for each item.
   */
  @Input({ transform: booleanAttribute })
  showAutofillButton: boolean;

  /**
   * Remove the bottom margin from the bit-section in this component
   * (used for containers at the end of the page where bottom margin is not needed)
   */
  @Input({ transform: booleanAttribute })
  disableSectionMargin: boolean = false;

  /**
   * The tooltip text for the organization icon for ciphers that belong to an organization.
   * @param cipher
   */
  orgIconTooltip(cipher: PopupCipherView) {
    if (cipher.collectionIds.length > 1) {
      return this.i18nService.t("nCollections", cipher.collectionIds.length);
    }

    return cipher.collections[0]?.name;
  }

  constructor(
    private i18nService: I18nService,
    private vaultPopupAutofillService: VaultPopupAutofillService,
    private passwordRepromptService: PasswordRepromptService,
    private cipherService: CipherService,
    private router: Router,
    private dialogService: DialogService,
  ) {}

  /**
   * Launches the login cipher in a new browser tab.
   */
  async launchCipher(cipher: CipherView) {
    if (!cipher.canLaunch) {
      return;
    }

    // If there is a view action pending, clear it
    if (this.viewCipherTimeout != null) {
      window.clearTimeout(this.viewCipherTimeout);
      this.viewCipherTimeout = null;
    }

    await this.cipherService.updateLastLaunchedDate(cipher.id);

    await BrowserApi.createNewTab(cipher.login.launchUri);

    if (BrowserPopupUtils.inPopup(window)) {
      BrowserApi.closePopup(window);
    }
  }

  async doAutofill(cipher: PopupCipherView) {
    await this.vaultPopupAutofillService.doAutofill(cipher);
  }

  async onViewCipher(cipher: PopupCipherView) {
    // We already have a view action in progress, don't start another
    if (this.viewCipherTimeout != null) {
      return;
    }

    // Wrap in a timeout to allow for double click to launch
    this.viewCipherTimeout = window.setTimeout(
      async () => {
        try {
          if (cipher.decryptionFailure) {
            DecryptionFailureDialogComponent.open(this.dialogService, {
              cipherIds: [cipher.id as CipherId],
            });
            return;
          }

          const repromptPassed = await this.passwordRepromptService.passwordRepromptCheck(cipher);
          if (!repromptPassed) {
            return;
          }
          await this.router.navigate(["/view-cipher"], {
            queryParams: { cipherId: cipher.id, type: cipher.type },
          });
        } finally {
          // Ensure the timeout is always cleared
          this.viewCipherTimeout = null;
        }
      },
      cipher.canLaunch ? 200 : 0,
    );
  }
}
