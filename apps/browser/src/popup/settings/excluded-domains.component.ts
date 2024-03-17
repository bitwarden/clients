import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { BrowserApi } from "../../platform/browser/browser-api";
import { enableAccountSwitching } from "../../platform/flags";

interface ExcludedDomain {
  uri: string;
  showCurrentUris: boolean;
}

const BroadcasterSubscriptionId = "excludedDomains";

@Component({
  selector: "app-excluded-domains",
  templateUrl: "excluded-domains.component.html",
})
export class ExcludedDomainsComponent implements OnInit, OnDestroy {
  excludedDomains: ExcludedDomain[] = [];
  existingExcludedDomains: ExcludedDomain[] = [];
  currentUris: string[];
  loadCurrentUrisTimeout: number;
  accountSwitcherEnabled = false;

  constructor(
    private domainSettingsService: DomainSettingsService,
    private i18nService: I18nService,
    private router: Router,
    private broadcasterService: BroadcasterService,
    private ngZone: NgZone,
    private platformUtilsService: PlatformUtilsService,
  ) {
    this.accountSwitcherEnabled = enableAccountSwitching();
  }

  async ngOnInit() {
    const savedDomains = await firstValueFrom(this.domainSettingsService.neverDomains$);
    if (savedDomains) {
      for (const uri of Object.keys(savedDomains)) {
        this.excludedDomains.push({ uri: uri, showCurrentUris: false });
        this.existingExcludedDomains.push({ uri: uri, showCurrentUris: false });
      }
    }

    await this.loadCurrentUris();

    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.ngZone.run(async () => {
        switch (message.command) {
          case "tabChanged":
          case "windowChanged":
            if (this.loadCurrentUrisTimeout != null) {
              window.clearTimeout(this.loadCurrentUrisTimeout);
            }
            this.loadCurrentUrisTimeout = window.setTimeout(
              async () => await this.loadCurrentUris(),
              500,
            );
            break;
          default:
            break;
        }
      });
    });
  }

  ngOnDestroy() {
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
  }

  async addUri() {
    this.excludedDomains.push({ uri: "", showCurrentUris: false });
  }

  async removeUri(i: number) {
    this.excludedDomains.splice(i, 1);
  }

  async submit() {
    const savedDomains: { [name: string]: null } = {};
    const newExcludedDomains = this.getNewlyAddedDomains(this.excludedDomains);
    for (const domain of this.excludedDomains) {
      const resp = newExcludedDomains.filter((e) => e.uri === domain.uri);
      if (resp.length === 0) {
        savedDomains[domain.uri] = null;
      } else {
        if (domain.uri && domain.uri !== "") {
          const validDomain = Utils.getHostname(domain.uri);
          if (!validDomain) {
            this.platformUtilsService.showToast(
              "error",
              null,
              this.i18nService.t("excludedDomainsInvalidDomain", domain.uri),
            );
            return;
          }
          savedDomains[validDomain] = null;
        }
      }
    }

    await this.domainSettingsService.setNeverDomains(savedDomains);
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/tabs/settings"]);
  }

  trackByFunction(index: number, item: any) {
    return index;
  }

  getNewlyAddedDomains(domain: ExcludedDomain[]): ExcludedDomain[] {
    const result = this.excludedDomains.filter(
      (newDomain) =>
        !this.existingExcludedDomains.some((oldDomain) => newDomain.uri === oldDomain.uri),
    );
    return result;
  }

  toggleUriInput(domain: ExcludedDomain) {
    domain.showCurrentUris = !domain.showCurrentUris;
  }

  async loadCurrentUris() {
    const tabs = await BrowserApi.tabsQuery({ windowType: "normal" });
    if (tabs) {
      const uriSet = new Set(tabs.map((tab) => Utils.getHostname(tab.url)));
      uriSet.delete(null);
      this.currentUris = Array.from(uriSet);
    }
  }
}
