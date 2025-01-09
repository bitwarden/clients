// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CdkVirtualScrollViewport, ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  booleanAttribute,
  Component,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
  Signal,
  signal,
  ViewChild,
} from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BadgeModule,
  ButtonModule,
  CompactModeService,
  DisclosureComponent,
  DisclosureTriggerForDirective,
  IconButtonModule,
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";
import { OrgIconDirective, PasswordRepromptService } from "@bitwarden/vault";

import { BrowserApi } from "../../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../../platform/popup/browser-popup-utils";
import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";
import { VaultPopupSectionService } from "../../../services/vault-popup-section.service";
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
    DisclosureComponent,
    DisclosureTriggerForDirective,
  ],
  selector: "app-vault-list-items-container",
  templateUrl: "vault-list-items-container.component.html",
  standalone: true,
})
export class VaultListItemsContainerComponent implements OnInit, AfterViewInit {
  private compactModeService = inject(CompactModeService);
  private vaultPopupSectionService = inject(VaultPopupSectionService);

  @ViewChild(CdkVirtualScrollViewport, { static: false }) viewPort: CdkVirtualScrollViewport;
  @ViewChild(DisclosureComponent) disclosure: DisclosureComponent;

  /**
   * Indicates whether the section should be open or closed if collapsibleKey is provided
   */
  protected sectionOpenState: Signal<boolean> | undefined;

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
   * Optionally allow the items to be collapsed.
   *
   * The key must be added to the state definition in `vault-popup-section.service.ts` since the
   * collapsed state is stored locally.
   */
  @Input()
  collapsibleKey: "favorites" | "allItems" | undefined;

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
   * Option to perform autofill operation as the primary action for autofill suggestions.
   */
  @Input({ transform: booleanAttribute })
  primaryActionAutofill: boolean;

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

  protected autofillShortcutTooltip = signal<string | undefined>(undefined);

  constructor(
    private i18nService: I18nService,
    private vaultPopupAutofillService: VaultPopupAutofillService,
    private passwordRepromptService: PasswordRepromptService,
    private cipherService: CipherService,
    private router: Router,
    private platformUtilsService: PlatformUtilsService,
  ) {}

  ngOnInit(): void {
    if (!this.collapsibleKey) {
      return;
    }

    this.sectionOpenState = this.vaultPopupSectionService.getOpenDisplayStateForSection(
      this.collapsibleKey,
    );
  }

  async ngAfterViewInit() {
    const autofillShortcut = await this.platformUtilsService.getAutofillKeyboardShortcut();

    if (autofillShortcut === "") {
      this.autofillShortcutTooltip.set(undefined);
    } else {
      const autofillTitle = this.i18nService.t("autoFill");

      this.autofillShortcutTooltip.set(`${autofillTitle} ${autofillShortcut}`);
    }
  }

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

  /**
   * Update section open/close state based on user action
   */
  async toggleSectionOpen() {
    if (!this.collapsibleKey) {
      return;
    }

    await this.vaultPopupSectionService.updateSectionOpenStoredState(
      this.collapsibleKey,
      this.disclosure.open,
    );
  }

  /**
   * Force virtual scroll to update its viewport size to avoid display bugs
   *
   * Angular CDK scroll has a bug when used with conditional rendering:
   * https://github.com/angular/components/issues/24362
   */
  protected rerenderViewport() {
    setTimeout(() => {
      this.viewPort.checkViewportSize();
    });
  }
}
