import { BehaviorSubject, combineLatest, mergeMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BadgeSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/badge-settings.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { BadgeService } from "../../platform/badge/badge.service";
import { BadgeStatePriority } from "../../platform/badge/priority";
import { BrowserApi } from "../../platform/browser/browser-api";

const StateName = "autofill-badge";

export class AutofillBadgeUpdaterService {
  private currentTab$ = new BehaviorSubject<chrome.tabs.Tab | null>(null);

  constructor(
    private badgeService: BadgeService,
    private accountService: AccountService,
    private cipherService: CipherService,
    private badgeSettingsService: BadgeSettingsServiceAbstraction,
  ) {
    combineLatest({
      account: this.accountService.activeAccount$,
      enableBadgeCounter: this.badgeSettingsService.enableBadgeCounter$,
      tab: this.currentTab$,
    })
      .pipe(
        mergeMap(async ({ account, enableBadgeCounter, tab }) => {
          if (!account || !tab || !tab.url) {
            return { cipherCount: 0, enableBadgeCounter };
          }

          const ciphers = await this.cipherService.getAllDecryptedForUrl(tab.url, account.id);
          return { cipherCount: ciphers.length, enableBadgeCounter, tab };
        }),
        mergeMap(async ({ cipherCount, enableBadgeCounter, tab }) => {
          if (!enableBadgeCounter || cipherCount === 0) {
            await this.badgeService.clearState(StateName);
            return;
          }

          const countText = cipherCount > 9 ? "9+" : cipherCount.toString();
          await this.badgeService.setState(
            StateName,
            BadgeStatePriority.Default,
            {
              text: countText,
            },
            tab.id,
          );
        }),
      )
      .subscribe();
  }

  async refresh() {
    this.currentTab$.next(await this.getTab());
  }

  private async getTab() {
    return (
      (await BrowserApi.tabsQueryFirst({ active: true, currentWindow: true })) ??
      (await BrowserApi.tabsQueryFirst({ active: true, lastFocusedWindow: true })) ??
      (await BrowserApi.tabsQueryFirst({ active: true }))
    );
  }
}
