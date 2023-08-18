import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import { Router } from "@angular/router";
import { Subject } from "rxjs";
import { debounceTime, takeUntil } from "rxjs/operators";

import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PasswordRepromptService } from "@bitwarden/common/vault/abstractions/password-reprompt.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AutofillService } from "../../../../autofill/services/abstractions/autofill.service";
import { BrowserApi } from "../../../../platform/browser/browser-api";
import { NavigatableListComponent } from "../../../../popup/components/navigatable-list.component";
import { PopupUtilsService } from "../../../../popup/services/popup-utils.service";
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

  private totpCode: string;
  private totpTimeout: number;
  private loadedTimeout: number;
  private searchTimeout: number;

  @ViewChild(NavigatableListComponent) navigatableListComponent: NavigatableListComponent;

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private cipherService: CipherService,
    private popupUtilsService: PopupUtilsService,
    private autofillService: AutofillService,
    private i18nService: I18nService,
    private router: Router,
    private ngZone: NgZone,
    private broadcasterService: BroadcasterService,
    private changeDetectorRef: ChangeDetectorRef,
    private syncService: SyncService,
    private searchService: SearchService,
    private stateService: StateService,
    private passwordRepromptService: PasswordRepromptService,
    private organizationService: OrganizationService,
    private vaultFilterService: VaultFilterService,
    private element: ElementRef
  ) {}

  async ngOnInit() {
    this.searchTypeSearch = !this.platformUtilsService.isSafari();
    this.inSidebar = this.popupUtilsService.inSidebar(window);

    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
      this.ngZone.run(async () => {
        switch (message.command) {
          case "syncCompleted":
            if (this.isLoading) {
              window.setTimeout(() => {
                this.load();
              }, 500);
            }
            break;
          case "collectPageDetailsResponse":
            if (message.sender === BroadcasterSubscriptionId) {
              this.pageDetails.push({
                frameId: message.webExtSender.frameId,
                tab: message.tab,
                details: message.details,
              });
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
      .pipe(debounceTime(500), takeUntil(this.destroy$))
      .subscribe(() => this.searchVault());

    // activate autofill on page load if policy is set
    if (await this.stateService.getActivateAutoFillOnPageLoadFromPolicy()) {
      await this.stateService.setEnableAutoFillOnPageLoad(true);
      await this.stateService.setActivateAutoFillOnPageLoadFromPolicy(false);
      this.platformUtilsService.showToast(
        "info",
        null,
        this.i18nService.t("autofillPageLoadPolicyActivated")
      );
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
    this.router.navigate(["/add-cipher"], {
      queryParams: {
        name: this.hostname,
        uri: this.url,
        selectedVault: this.vaultFilterService.getVaultFilter().selectedOrganizationId,
      },
    });
  }

  viewCipher(cipher: CipherView) {
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
      if (this.popupUtilsService.inPopup(window)) {
        if (!closePopupDelay) {
          if (this.platformUtilsService.isFirefox() || this.platformUtilsService.isSafari()) {
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

  searchVault() {
    if (!this.searchService.isSearchable(this.searchText)) {
      return;
    }

    this.router.navigate(["/tabs/vault"], { queryParams: { searchText: this.searchText } });
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

    this.hostname = Utils.getHostname(this.url);
    this.pageDetails = [];
    BrowserApi.tabSendMessage(this.tab, {
      command: "collectPageDetails",
      tab: this.tab,
      sender: BroadcasterSubscriptionId,
    });

    const otherTypes: CipherType[] = [];
    const dontShowCards = await this.stateService.getDontShowCardsCurrentTab();
    const dontShowIdentities = await this.stateService.getDontShowIdentitiesCurrentTab();
    this.showOrganizations = this.organizationService.hasOrganizations();
    if (!dontShowCards) {
      otherTypes.push(CipherType.Card);
    }
    if (!dontShowIdentities) {
      otherTypes.push(CipherType.Identity);
    }

    const ciphers = await this.cipherService.getAllDecryptedForUrl(
      this.url,
      otherTypes.length > 0 ? otherTypes : null
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

    this.loginCiphers = this.loginCiphers.sort((a, b) =>
      this.cipherService.sortCiphersByLastUsedThenName(a, b)
    );
    this.isLoading = this.loaded = true;
  }

  async goToSettings() {
    this.router.navigate(["autofill"]);
  }

  async dismissCallout() {
    await this.stateService.setDismissedAutofillCallout(true);
    this.showHowToAutofill = false;
  }

  private async setCallout() {
    this.showHowToAutofill =
      this.loginCiphers.length > 0 &&
      !(await this.stateService.getEnableAutoFillOnPageLoad()) &&
      !(await this.stateService.getDismissedAutofillCallout());

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

  @HostListener("keydown", ["$event"])
  onKeydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown" && !this.navigatableListComponent.isFocused()) {
      this.navigatableListComponent.focusTop();
      event.preventDefault();
    } else if (event.ctrlKey && event.key === "f") {
      this.element.nativeElement.querySelector("#search").focus();
      event.preventDefault();
    }
  }
}
