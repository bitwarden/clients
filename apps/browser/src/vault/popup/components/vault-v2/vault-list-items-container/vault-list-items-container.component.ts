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
  Output,
  Signal,
  signal,
  ViewChild,
  computed,
  OnInit,
  ChangeDetectionStrategy,
  input,
} from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, Observable, map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
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
import { VaultPopupSectionService } from "../../../services/vault-popup-section.service";
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
export class VaultListItemsContainerComponent implements OnInit, AfterViewInit {
  private compactModeService = inject(CompactModeService);
  private vaultPopupSectionService = inject(VaultPopupSectionService);
  protected CipherViewLikeUtils = CipherViewLikeUtils;

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

  ciphers = input<PopupCipherViewLike[]>([]);

  /**
   * If true, we will group ciphers by type (Login, Card, Identity)
   * within subheadings in a single container, converted to a WritableSignal.
   */
  groupByType = input<boolean>(false);

  /**
   * Computed signal for a grouped list of ciphers with an optional header
   */
  cipherGroups$ = computed<
    {
      subHeaderKey?: string | null;
      ciphers: PopupCipherViewLike[];
    }[]
  >(() => {
    const groups: { [key: string]: PopupCipherViewLike[] } = {};

    this.ciphers().forEach((cipher) => {
      let groupKey;

      if (this.groupByType()) {
        switch (CipherViewLikeUtils.getType(cipher)) {
          case CipherType.Card:
            groupKey = "cards";
            break;
          case CipherType.Identity:
            groupKey = "identities";
            break;
        }
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }

      groups[groupKey].push(cipher);
    });

    return Object.keys(groups).map((key) => ({
      subHeaderKey: this.groupByType ? key : "",
      ciphers: groups[key],
    }));
  });

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
   * Flag indicating that the current tab location is blocked
   */
  currentURIIsBlocked$: Observable<boolean> =
    this.vaultPopupAutofillService.currentTabIsOnBlocklist$;

  /**
   * Resolved i18n key to use for suggested cipher items
   */
  cipherItemTitleKey = (cipher: CipherViewLike) =>
    this.currentURIIsBlocked$.pipe(
      map((uriIsBlocked) => {
        const login = CipherViewLikeUtils.getLogin(cipher);
        const hasUsername = login?.username != null;
        const key = this.primaryActionAutofill && !uriIsBlocked ? "autofillTitle" : "viewItemTitle";
        return hasUsername ? `${key}WithField` : key;
      }),
    );

  /**
   * Option to show the autofill button for each item.
   */
  @Input({ transform: booleanAttribute })
  showAutofillButton: boolean;

  /**
   * Flag indicating whether the suggested cipher item autofill button should be shown or not
   */
  hideAutofillButton$ = this.currentURIIsBlocked$.pipe(
    map((uriIsBlocked) => !this.showAutofillButton || uriIsBlocked || this.primaryActionAutofill),
  );

  /**
   * Flag indicating whether the cipher item autofill options should be shown or not
   */
  hideAutofillOptions$: Observable<boolean> = this.currentURIIsBlocked$.pipe(
    map((uriIsBlocked) => uriIsBlocked || this.showAutofillButton),
  );

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
   * Remove the description margin
   */
  @Input({ transform: booleanAttribute })
  disableDescriptionMargin: boolean = false;

  /**
   * The tooltip text for the organization icon for ciphers that belong to an organization.
   * @param cipher
   */
  orgIconTooltip({ collectionIds, collections }: PopupCipherViewLike) {
    if (collectionIds.length > 1) {
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

  async primaryActionOnSelect(cipher: PopupCipherViewLike) {
    const isBlocked = await firstValueFrom(this.currentURIIsBlocked$);

    return this.primaryActionAutofill && !isBlocked
      ? this.doAutofill(cipher)
      : this.onViewCipher(cipher);
  }

  /**
   * Launches the login cipher in a new browser tab.
   */
  async launchCipher(cipher: CipherViewLike) {
    if (!CipherViewLikeUtils.canLaunch(cipher)) {
      return;
    }

    // If there is a view action pending, clear it
    if (this.viewCipherTimeout != null) {
      window.clearTimeout(this.viewCipherTimeout);
      this.viewCipherTimeout = null;
    }

    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherService.updateLastLaunchedDate(cipher.id, activeUserId);

    await BrowserApi.createNewTab(CipherViewLikeUtils.getLaunchUri(cipher));

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
    const _cipher = await this.cipherService.get(cipher.id, activeUserId);
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
          this.viewCipherTimeout = null;
        }
      },
      CipherViewLikeUtils.canLaunch(cipher) ? 200 : 0,
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
