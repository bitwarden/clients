import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, map, Observable, startWith } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherViewLikeUtils } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { IconButtonModule, TypographyModule } from "@bitwarden/components";

import BrowserPopupUtils from "../../../../../platform/browser/browser-popup-utils";
import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";
import { VaultPopupItemsService } from "../../../services/vault-popup-items.service";
import { PopupCipherViewLike } from "../../../views/popup-cipher.view";
import { VaultListItemsContainerComponent } from "../vault-list-items-container/vault-list-items-container.component";

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
export class AutofillVaultListItemsComponent {
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

  protected groupByType = toSignal(
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

  /**
   * Flag indicating that the current tab location is blocked
   */
  currentURIIsBlocked$: Observable<boolean> =
    this.vaultPopupAutofillService.currentTabIsOnBlocklist$;

  constructor(
    private vaultPopupItemsService: VaultPopupItemsService,
    private vaultPopupAutofillService: VaultPopupAutofillService,
    private vaultSettingsService: VaultSettingsService,
  ) {}

  /**
   * Refreshes the current tab to re-populate the autofill ciphers.
   * @protected
   */
  protected refreshCurrentTab() {
    this.vaultPopupAutofillService.refreshCurrentTab();
  }
}
