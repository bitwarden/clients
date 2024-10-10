import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { Subject, firstValueFrom, from, Subscription } from "rxjs";
import { debounceTime, switchMap, takeUntil } from "rxjs/operators";

import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AutofillOverlayVisibility } from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { PasswordRepromptService } from "@bitwarden/vault";

import { AutofillService } from "../../../../autofill/services/abstractions/autofill.service";
import { BrowserApi } from "../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../platform/popup/browser-popup-utils";
import { VaultFilterService } from "../../../services/vault-filter.service";

const BroadcasterSubscriptionId = "CurrentTabComponent";

@Component({
  selector: "app-current-tab",
  templateUrl: "current-tab.component.html",
})
export class CurrentTabComponent implements OnInit, OnDestroy {
  pageDetails: any[] = [];
  tab: chrome.tabs.Tab;
  cardCiphers: CipherView[];
  identityCiphers: CipherView[];
  loginCiphers: CipherView[];
  url: string;
  hostname: string;
  searchText: string;
  inSidebar = false;
  searchTypeSearch = false;
  loaded = false;
  isLoading = false;
  showOrganizations = false;
  showHowToAutofill = false;
  autofillCalloutText: string;
  protected search$ = new Subject<void>();
  private destroy$ = new Subject<void>();
  private collectPageDetailsSubscription: Subscription;

  private totpCode: string;
  private totpTimeout: number;
  private loadedTimeout: number;
  private searchTimeout: number;

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private cipherService: CipherService,
    private autofillService: AutofillService,
    private i18nService: I18nService,
    private router: Router,
    private ngZone: NgZone,
    private broadcasterService: BroadcasterService,
    private changeDetectorRef: ChangeDetectorRef,
    private syncService: SyncService,
    private searchService: SearchService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private passwordRepromptService: PasswordRepromptService,
    private organizationService: OrganizationService,
    private vaultFilterService: VaultFilterService,
    private vaultSettingsService: VaultSettingsService,
  ) {}

  async ngOnInit() {
    this.searchTypeSearch = !this.platformUtilsService.isSafari();
    this.inSidebar = BrowserPopupUtils.inSidebar(window);

    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.ngZone.run(async () => {
        switch (message.command) {
          case "syncCompleted":
            if (this.isLoading) {
              window.setTimeout(() => {
                // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                this.load();
              }, 500);
            }
            break;
          default:
            break;
        }

        this.changeDetectorRef.detectChanges();
      });
    });

    if (!this.syncService.syncInProgress) {
      await this.load();
      await this.setCallout();
    } else {
      this.loadedTimeout = window.setTimeout(async () => {
        if (!this.isLoading) {
          await this.load();
          await this.setCallout();
        }
      }, 5000);
    }

    this.search$
      .pipe(
        debounceTime(500),
        switchMap(() => {
          return from(this.searchVault());
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    const autofillOnPageLoadOrgPolicy = await firstValueFrom(
      this.autofillSettingsService.activateAutofillOnPageLoadFromPolicy$,
    );
    const autofillOnPageLoadPolicyToastHasDisplayed = await firstValueFrom(
      this.autofillSettingsService.autofillOnPageLoadPolicyToastHasDisplayed$,
    );

    // If the org "autofill on page load" policy is set, set the user setting to match it
    // @TODO override user setting instead of overwriting
    if (autofillOnPageLoadOrgPolicy === true) {
      await this.autofillSettingsService.setAutofillOnPageLoad(true);

      if (!autofillOnPageLoadPolicyToastHasDisplayed) {
        this.platformUtilsService.showToast(
          "info",
          null,
          this.i18nService.t("autofillPageLoadPolicyActivated"),
        );

        await this.autofillSettingsService.setAutofillOnPageLoadPolicyToastHasDisplayed(true);
      }
    }

    // If the org policy is ever disabled after being enabled, reset the toast notification
    if (!autofillOnPageLoadOrgPolicy && autofillOnPageLoadPolicyToastHasDisplayed) {
      await this.autofillSettingsService.setAutofillOnPageLoadPolicyToastHasDisplayed(false);
    }
  }

  ngOnDestroy() {
    window.clearTimeout(this.loadedTimeout);
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);

    this.destroy$.next();
    this.destroy$.complete();
  }

  async refresh() {
    await this.load();
  }

  addCipher() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/add-cipher"], {
      queryParams: {
        name: this.hostname,
        uri: this.url,
        selectedVault: this.vaultFilterService.getVaultFilter().selectedOrganizationId,
      },
    });
  }

  viewCipher(cipher: CipherView) {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/view-cipher"], { queryParams: { cipherId: cipher.id } });
  }

  async fillCipher(cipher: CipherView, closePopupDelay?: number) {
    if (
      cipher.reprompt !== CipherRepromptType.None &&
      !(await this.passwordRepromptService.showPasswordPrompt())
    ) {
      return;
    }

    this.totpCode = null;
    if (this.totpTimeout != null) {
      window.clearTimeout(this.totpTimeout);
    }

    if (this.pageDetails == null || this.pageDetails.length === 0) {
      this.platformUtilsService.showToast("error", null, this.i18nService.t("autofillError"));
      return;
    }

    try {
      this.totpCode = await this.autofillService.doAutoFill({
        tab: this.tab,
        cipher: cipher,
        pageDetails: this.pageDetails,
        doc: window.document,
        fillNewPassword: true,
        allowTotpAutofill: true,
      });
      if (this.totpCode != null) {
        this.platformUtilsService.copyToClipboard(this.totpCode, { window: window });
      }
      if (BrowserPopupUtils.inPopup(window)) {
        if (!closePopupDelay) {
          if (this.platformUtilsService.isSafari()) {
            BrowserApi.closePopup(window);
          } else {
            // Slight delay to fix bug in Chromium browsers where popup closes without copying totp to clipboard
            setTimeout(() => BrowserApi.closePopup(window), 50);
          }
        } else {
          setTimeout(() => BrowserApi.closePopup(window), closePopupDelay);
        }
      }
    } catch {
      this.ngZone.run(() => {
        this.platformUtilsService.showToast("error", null, this.i18nService.t("autofillError"));
        this.changeDetectorRef.detectChanges();
      });
    }
  }

  async searchVault() {
    if (!(await this.searchService.isSearchable(this.searchText))) {
      return;
    }

    await this.router.navigate(["/tabs/vault"], { queryParams: { searchText: this.searchText } });
  }

  closeOnEsc(e: KeyboardEvent) {
    // If input not empty, use browser default behavior of clearing input instead
    if (e.key === "Escape" && (this.searchText == null || this.searchText === "")) {
      BrowserApi.closePopup(window);
    }
  }

  protected async load() {
    this.isLoading = false;
    this.tab = await BrowserApi.getTabFromCurrentWindow();

    if (this.tab != null) {
      this.url = this.tab.url;
    } else {
      this.loginCiphers = [];
      this.isLoading = this.loaded = true;
      return;
    }

    this.pageDetails = [];
    this.collectPageDetailsSubscription?.unsubscribe();
    this.collectPageDetailsSubscription = this.autofillService
      .collectPageDetailsFromTab$(this.tab)
      .pipe(takeUntil(this.destroy$))
      .subscribe((pageDetails) => (this.pageDetails = pageDetails));

    this.hostname = Utils.getHostname(this.url);
    const otherTypes: CipherType[] = [];
    const dontShowCards = !(await firstValueFrom(this.vaultSettingsService.showCardsCurrentTab$));
    const dontShowIdentities = !(await firstValueFrom(
      this.vaultSettingsService.showIdentitiesCurrentTab$,
    ));
    this.showOrganizations = await this.organizationService.hasOrganizations();
    if (!dontShowCards) {
      otherTypes.push(CipherType.Card);
    }
    if (!dontShowIdentities) {
      otherTypes.push(CipherType.Identity);
    }

    const ciphers = await this.cipherService.getAllDecryptedForUrl(
      this.url,
      otherTypes.length > 0 ? otherTypes : null,
    );

    this.loginCiphers = [];
    this.cardCiphers = [];
    this.identityCiphers = [];

    ciphers.forEach((c) => {
      if (!this.vaultFilterService.filterCipherForSelectedVault(c)) {
        switch (c.type) {
          case CipherType.Login:
            this.loginCiphers.push(c);
            break;
          case CipherType.Card:
            this.cardCiphers.push(c);
            break;
          case CipherType.Identity:
            this.identityCiphers.push(c);
            break;
          default:
            break;
        }
      }
    });

    if (this.loginCiphers.length) {
      this.loginCiphers = this.loginCiphers.sort((a, b) =>
        this.cipherService.sortCiphersByLastUsedThenName(a, b),
      );
    }

    this.isLoading = this.loaded = true;
  }

  async goToSettings() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["autofill"]);
  }

  async dismissCallout() {
    await this.autofillSettingsService.setAutofillOnPageLoadCalloutIsDismissed(true);
    this.showHowToAutofill = false;
  }

  private async setCallout() {
    const inlineMenuVisibilityIsOff =
      (await firstValueFrom(this.autofillSettingsService.inlineMenuVisibility$)) ===
      AutofillOverlayVisibility.Off;

    this.showHowToAutofill =
      this.loginCiphers.length > 0 &&
      inlineMenuVisibilityIsOff &&
      !(await firstValueFrom(this.autofillSettingsService.autofillOnPageLoad$)) &&
      !(await firstValueFrom(this.autofillSettingsService.autofillOnPageLoadCalloutIsDismissed$));

    if (this.showHowToAutofill) {
      const autofillCommand = await this.platformUtilsService.getAutofillKeyboardShortcut();
      await this.setAutofillCalloutText(autofillCommand);
    }
  }

  private setAutofillCalloutText(command: string) {
    if (command) {
      this.autofillCalloutText = this.i18nService.t("autofillSelectInfoWithCommand", command);
    } else {
      this.autofillCalloutText = this.i18nService.t("autofillSelectInfoWithoutCommand");
    }
  }
}
