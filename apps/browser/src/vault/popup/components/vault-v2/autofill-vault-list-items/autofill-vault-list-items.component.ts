import { CommonModule } from "@angular/common";
import { Component, DestroyRef, OnInit, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, filter, from, map, Observable, startWith, switchMap, take } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherViewLikeUtils } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { IconButtonModule, TypographyModule } from "@bitwarden/components";

import BrowserPopupUtils from "../../../../../platform/browser/browser-popup-utils";
import { VaultPopupAutofillSuggestionsInfoService } from "../../../services/vault-popup-autofill-suggestions-info.service";
import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";
import { VaultPopupItemsService } from "../../../services/vault-popup-items.service";
import { PopupCipherViewLike } from "../../../views/popup-cipher.view";
import { VaultListItemsContainerComponent } from "../vault-list-items-container/vault-list-items-container.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  imports: [
    CommonModule,
    TypographyModule,
    VaultListItemsContainerComponent,
    JslibModule,
    IconButtonModule,
  ],
  selector: "app-autofill-vault-list-items",
  templateUrl: "autofill-vault-list-items.component.html",
})
export class AutofillVaultListItemsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);

  /**
   * The list of ciphers that can be used to autofill the current page.
   * @protected
   */
  protected autofillCiphers$: Observable<PopupCipherViewLike[]> =
    this.vaultPopupItemsService.autoFillCiphers$;

  /**
   * Flag indicating whether the refresh button should be shown. Only shown when the popup is within the FF sidebar.
   * @protected
   */
  protected showRefresh: boolean = BrowserPopupUtils.inSidebar(window);

  /** Flag indicating whether the login item should automatically autofill when clicked  */
  protected clickItemsToAutofillVaultView$: Observable<boolean> =
    this.vaultSettingsService.clickItemsToAutofillVaultView$.pipe(
      startWith(true), // Start with true to avoid flashing the fill button on first load
    );

  /** When true, the info icon should ping (4 iterations). */
  protected readonly pingInfoIcon = signal(false);

  /** Flag indicating that the current tab location is blocked */
  protected readonly currentURIIsBlocked$: Observable<boolean> =
    this.vaultPopupAutofillService.currentTabIsOnBlocklist$;

  /** Computed state for the per-user info icon (dismissed/ping completed). */
  private readonly infoState$ = this.activeUserId$.pipe(
    switchMap((userId) => this.autofillSuggestionsInfoService.state$(userId)),
  );

  /**
   * Show the info icon only when:
   * - the current page is not blocked
   * - the autofill suggestions list is populated
   * - the user hasn't dismissed the info dialog
   */
  protected readonly showInfoIcon$ = combineLatest([
    this.autofillCiphers$,
    this.currentURIIsBlocked$,
    this.infoState$,
  ]).pipe(
    map(([ciphers, isBlocked, infoState]) => {
      const hasItems = (ciphers ?? []).length > 0;
      return !isBlocked && hasItems && !(infoState.dismissed ?? false);
    }),
  );

  protected readonly groupByType = toSignal(
    this.vaultPopupItemsService.hasFilterApplied$.pipe(map((hasFilter) => !hasFilter)),
  );

  /**
   * Observable that determines whether the empty autofill tip should be shown.
   * The tip is shown when there are no login ciphers to autofill, no filter is applied, and autofill is allowed in
   * the current context (e.g. not in a popout).
   * @protected
   */
  protected showEmptyAutofillTip$: Observable<boolean> = combineLatest([
    this.vaultPopupItemsService.hasFilterApplied$,
    this.autofillCiphers$,
    this.vaultPopupAutofillService.autofillAllowed$,
  ]).pipe(
    map(
      ([hasFilter, ciphers, canAutoFill]) =>
        !hasFilter &&
        canAutoFill &&
        ciphers.filter((c) => CipherViewLikeUtils.getType(c) == CipherType.Login).length === 0,
    ),
  );

  constructor(
    private vaultPopupItemsService: VaultPopupItemsService,
    private vaultPopupAutofillService: VaultPopupAutofillService,
    private vaultSettingsService: VaultSettingsService,
    private accountService: AccountService,
    private autofillSuggestionsInfoService: VaultPopupAutofillSuggestionsInfoService,
  ) {}

  ngOnInit() {
    // Start the ping animation once (4 iterations) the first time suggestions become populated.
    combineLatest([
      this.activeUserId$,
      this.autofillCiphers$,
      this.currentURIIsBlocked$,
      this.infoState$,
    ])
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(([_userId, ciphers, isBlocked, infoState]) => {
          const hasItems = (ciphers ?? []).length > 0;
          return (
            !isBlocked &&
            hasItems &&
            !(infoState.dismissed ?? false) &&
            !(infoState.pingCompleted ?? false)
          );
        }),
        take(1),
      )
      .subscribe(([userId]) => {
        // Mark completed immediately so it never replays across vault opens.
        void this.autofillSuggestionsInfoService.markPingCompleted(userId);

        this.pingInfoIcon.set(true);
        window.setTimeout(() => this.pingInfoIcon.set(false), 4000);
      });
  }

  protected openAutofillSuggestionsInfo(): void {
    // Keep the icon visible until the user dismisses the popover, but stop any ping immediately.
    this.pingInfoIcon.set(false);
  }

  protected dismissAutofillSuggestionsInfo(): void {
    this.pingInfoIcon.set(false);

    this.activeUserId$
      .pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef),
        switchMap((userId) => from(this.autofillSuggestionsInfoService.markDismissed(userId))),
      )
      .subscribe();
  }

  /**
   * Refreshes the current tab to re-populate the autofill ciphers.
   * @protected
   */
  protected refreshCurrentTab() {
    this.vaultPopupAutofillService.refreshCurrentTab();
  }
}
