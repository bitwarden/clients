import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, firstValueFrom, map, Observable } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  IconButtonModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

import BrowserPopupUtils from "../../../../../platform/popup/browser-popup-utils";
import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";
import { VaultPopupItemsService } from "../../../services/vault-popup-items.service";
import { PopupCipherView } from "../../../views/popup-cipher.view";
import { VaultListItemsContainerComponent } from "../vault-list-items-container/vault-list-items-container.component";

@Component({
  standalone: true,
  imports: [
    CommonModule,
    SectionComponent,
    TypographyModule,
    VaultListItemsContainerComponent,
    JslibModule,
    SectionHeaderComponent,
    IconButtonModule,
  ],
  selector: "app-autofill-vault-list-items",
  templateUrl: "autofill-vault-list-items.component.html",
})
export class AutofillVaultListItemsComponent implements OnInit {
  /**
   * The list of ciphers that can be used to autofill the current page.
   * @protected
   */
  protected autofillCiphers$: Observable<PopupCipherView[]> =
    this.vaultPopupItemsService.autoFillCiphers$;

  /**
   * Flag indicating whether the refresh button should be shown. Only shown when the popup is within the FF sidebar.
   * @protected
   */
  protected showRefresh: boolean = BrowserPopupUtils.inSidebar(window);

  clickItemsToAutofillVaultView = false;

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
        !hasFilter && canAutoFill && ciphers.filter((c) => c.type == CipherType.Login).length === 0,
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
  ) {
    // TODO: Migrate logic to show Autofill policy toast PM-8144
  }

  async ngOnInit() {
    this.clickItemsToAutofillVaultView = await firstValueFrom(
      this.vaultSettingsService.clickItemsToAutofillVaultView$,
    );
  }

  /**
   * Refreshes the current tab to re-populate the autofill ciphers.
   * @protected
   */
  protected refreshCurrentTab() {
    this.vaultPopupAutofillService.refreshCurrentTab();
  }
}
