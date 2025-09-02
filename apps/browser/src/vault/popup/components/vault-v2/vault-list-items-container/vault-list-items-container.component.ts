import { CdkVirtualScrollViewport, ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  booleanAttribute,
  Component,
  EventEmitter,
  inject,
  Output,
  Signal,
  signal,
  ViewChild,
  computed,
  ChangeDetectionStrategy,
  input,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  BadgeModule,
  ButtonModule,
  CompactModeService,
  DisclosureComponent,
  DisclosureTriggerForDirective,
  DialogService,
  IconButtonModule,
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
  ScrollLayoutDirective,
} from "@bitwarden/components";
import {
  DecryptionFailureDialogComponent,
  OrgIconDirective,
  PasswordRepromptService,
} from "@bitwarden/vault";

import { BrowserApi } from "../../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../../platform/browser/browser-popup-utils";
import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";
import {
  VaultPopupSectionService,
  PopupSectionOpen,
} from "../../../services/vault-popup-section.service";
import { PopupCipherViewLike } from "../../../views/popup-cipher.view";
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
    ItemCopyActionsComponent,
    ItemMoreOptionsComponent,
    OrgIconDirective,
    ScrollingModule,
    DisclosureComponent,
    DisclosureTriggerForDirective,
    ScrollLayoutDirective,
  ],
  selector: "app-vault-list-items-container",
  templateUrl: "vault-list-items-container.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VaultListItemsContainerComponent implements AfterViewInit {
  private compactModeService = inject(CompactModeService);
  private vaultPopupSectionService = inject(VaultPopupSectionService);
  protected CipherViewLikeUtils = CipherViewLikeUtils;

  @ViewChild(CdkVirtualScrollViewport, { static: false }) viewPort!: CdkVirtualScrollViewport;
  @ViewChild(DisclosureComponent) disclosure!: DisclosureComponent;

  /**
   * Indicates whether the section should be open or closed if collapsibleKey is provided
   */
  protected sectionOpenState: Signal<boolean> = computed(() => {
    if (!this.collapsibleKey()) {
      return true;
    }

    return (
      this.vaultPopupSectionService.getOpenDisplayStateForSection(this.collapsibleKey()!)() ?? true
    );
  });

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
  private viewCipherTimeout?: number;

  ciphers = input<PopupCipherViewLike[]>([]);

  /**
   * If true, we will group ciphers by type (Login, Card, Identity)
   * within subheadings in a single container, converted to a WritableSignal.
   */
  groupByType = input<boolean | undefined>(false);

  /**
   * Computed signal for a grouped list of ciphers with an optional header
   */
  cipherGroups = computed<
    {
      subHeaderKey?: string;
      ciphers: PopupCipherViewLike[];
    }[]
  >(() => {
    const ciphers = this.ciphers();

    // Not grouping by type, return a single group with all ciphers
    if (!this.groupByType() && ciphers.length > 0) {
      return [{ ciphers }];
    }

    const groups: Record<string, PopupCipherViewLike[]> = {};

    ciphers.forEach((cipher) => {
      let groupKey = "all";
      switch (CipherViewLikeUtils.getType(cipher)) {
        case CipherType.Card:
          groupKey = "cards";
          break;
        case CipherType.Identity:
          groupKey = "identities";
          break;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }

      groups[groupKey].push(cipher);
    });

    return Object.entries(groups).map(([key, ciphers]) => ({
      subHeaderKey: key != "all" ? key : undefined,
      ciphers: ciphers,
    }));
  });

  /**
   * Title for the vault list item section.
   */
  title = input<string | undefined>(undefined);

  /**
   * Optionally allow the items to be collapsed.
   *
   * The key must be added to the state definition in `vault-popup-section.service.ts` since the
   * collapsed state is stored locally.
   */
  collapsibleKey = input<keyof PopupSectionOpen | undefined>(undefined);

  /**
   * Optional description for the vault list item section. Will be shown below the title even when
   * no ciphers are available.
   */
  description = input<string | undefined>(undefined);

  /**
   * Option to show a refresh button in the section header.
   */
  showRefresh = input(false, { transform: booleanAttribute });

  /**
   * Event emitted when the refresh button is clicked.
   */
  @Output()
  onRefresh = new EventEmitter<void>();

  /**
   * Flag indicating that the current tab location is blocked
   */
  currentURIIsBlocked = toSignal(this.vaultPopupAutofillService.currentTabIsOnBlocklist$);

  /**
   * Resolved i18n key to use for suggested cipher items
   */
  cipherItemTitleKey = computed(() => {
    return (cipher: CipherViewLike) => {
      const login = CipherViewLikeUtils.getLogin(cipher);
      const hasUsername = login?.username != null;
      const key =
        this.primaryActionAutofill() && !this.currentURIIsBlocked()
          ? "autofillTitle"
          : "viewItemTitle";
      return hasUsername ? `${key}WithField` : key;
    };
  });

  /**
   * Option to show the autofill button for each item.
   */
  showAutofillButton = input(false, { transform: booleanAttribute });

  /**
   * Flag indicating whether the suggested cipher item autofill button should be shown or not
   */
  hideAutofillButton = computed(
    () => !this.showAutofillButton() || this.currentURIIsBlocked() || this.primaryActionAutofill(),
  );

  /**
   * Flag indicating whether the cipher item autofill menu options should be shown or not
   */
  hideAutofillMenuOptions = computed(() => this.currentURIIsBlocked() || this.showAutofillButton());

  /**
   * Option to perform autofill operation as the primary action for autofill suggestions.
   */
  primaryActionAutofill = input(false, { transform: booleanAttribute });

  /**
   * Remove the bottom margin from the bit-section in this component
   * (used for containers at the end of the page where bottom margin is not needed)
   */
  disableSectionMargin = input(false, { transform: booleanAttribute });

  /**
   * Remove the description margin
   */
  disableDescriptionMargin = input(false, { transform: booleanAttribute });

  /**
   * The tooltip text for the organization icon for ciphers that belong to an organization.
   * @param cipher
   */
  orgIconTooltip({ collectionIds, collections }: PopupCipherViewLike) {
    if (collectionIds.length > 1 || !collections) {
      return this.i18nService.t("nCollections", collectionIds.length);
    }

    return collections[0]?.name;
  }

  protected autofillShortcutTooltip = signal<string | undefined>(undefined);

  constructor(
    private i18nService: I18nService,
    private vaultPopupAutofillService: VaultPopupAutofillService,
    private passwordRepromptService: PasswordRepromptService,
    private cipherService: CipherService,
    private router: Router,
    private platformUtilsService: PlatformUtilsService,
    private dialogService: DialogService,
    private accountService: AccountService,
  ) {}

  async ngAfterViewInit() {
    const autofillShortcut = await this.platformUtilsService.getAutofillKeyboardShortcut();

    if (autofillShortcut === "") {
      this.autofillShortcutTooltip.set(undefined);
    } else {
      const autofillTitle = this.i18nService.t("autoFill");

      this.autofillShortcutTooltip.set(`${autofillTitle} ${autofillShortcut}`);
    }
  }

  primaryActionOnSelect(cipher: PopupCipherViewLike) {
    return this.primaryActionAutofill() && !this.currentURIIsBlocked()
      ? this.doAutofill(cipher)
      : this.onViewCipher(cipher);
  }

  /**
   * Launches the login cipher in a new browser tab.
   */
  async launchCipher(cipher: CipherViewLike) {
    const launchURI = CipherViewLikeUtils.getLaunchUri(cipher);
    if (!CipherViewLikeUtils.canLaunch(cipher) || !launchURI) {
      return;
    }

    // If there is a view action pending, clear it
    if (this.viewCipherTimeout != null) {
      window.clearTimeout(this.viewCipherTimeout);
      this.viewCipherTimeout = undefined;
    }

    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherService.updateLastLaunchedDate(uuidAsString(cipher.id!), activeUserId);

    await BrowserApi.createNewTab(launchURI);

    if (BrowserPopupUtils.inPopup(window)) {
      BrowserApi.closePopup(window);
    }
  }

  async doAutofill(cipher: PopupCipherViewLike) {
    if (!CipherViewLikeUtils.isCipherListView(cipher)) {
      await this.vaultPopupAutofillService.doAutofill(cipher);
      return;
    }

    // When only the `CipherListView` is available, fetch the full cipher details
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const _cipher = await this.cipherService.get(uuidAsString(cipher.id!), activeUserId);
    const cipherView = await this.cipherService.decrypt(_cipher, activeUserId);

    await this.vaultPopupAutofillService.doAutofill(cipherView);
  }

  async onViewCipher(cipher: PopupCipherViewLike) {
    // We already have a view action in progress, don't start another
    if (this.viewCipherTimeout != null) {
      return;
    }

    // Wrap in a timeout to allow for double click to launch
    this.viewCipherTimeout = window.setTimeout(
      async () => {
        try {
          if (CipherViewLikeUtils.decryptionFailure(cipher)) {
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
          this.viewCipherTimeout = undefined;
        }
      },
      CipherViewLikeUtils.canLaunch(cipher) ? 200 : 0,
    );
  }

  /**
   * Update section open/close state based on user action
   */
  async toggleSectionOpen() {
    if (!this.collapsibleKey()) {
      return;
    }

    await this.vaultPopupSectionService.updateSectionOpenStoredState(
      this.collapsibleKey()!,
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
