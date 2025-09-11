import { combineLatest, distinctUntilChanged, mergeMap, of, switchMap, withLatestFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BadgeSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/badge-settings.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { Tab } from "../../platform/badge/badge-browser-api";
import { BadgeService } from "../../platform/badge/badge.service";
import { BadgeStatePriority } from "../../platform/badge/priority";

const StateName = (tabId: number) => `autofill-badge-${tabId}`;

export class AutofillBadgeUpdaterService {
  constructor(
    private badgeService: BadgeService,
    private accountService: AccountService,
    private cipherService: CipherService,
    private badgeSettingsService: BadgeSettingsServiceAbstraction,
    private logService: LogService,
  ) {}

  init() {
    const ciphers$ = this.accountService.activeAccount$.pipe(
      switchMap((account) => (account?.id ? this.cipherService.ciphers$(account?.id) : of([]))),
    );

    this.badgeService.setDynamicState("autofill-badge-updater", (activeTabsUpdated$) => {});

    // Recalculate badges for all active tabs when ciphers or active account changes
    combineLatest({
      account: this.accountService.activeAccount$,
      enableBadgeCounter:
        this.badgeSettingsService.enableBadgeCounter$.pipe(distinctUntilChanged()),
      ciphers: ciphers$,
    })
      .pipe(
        mergeMap(async ({ account, enableBadgeCounter }) => {
          if (!account) {
            return;
          }

          const tabs = await this.badgeService.getActiveTabs();

          for (const tab of tabs) {
            if (!tab.tabId) {
              continue;
            }
            if (enableBadgeCounter) {
              await this.setTabState(tab, account.id);
            } else {
              await this.clearTabState(tab.tabId);
            }
          }
        }),
      )
      .subscribe();

    // Recalculate badge for a specific tab when it becomes active
    this.badgeService.activeTabsUpdated$
      .pipe(
        withLatestFrom(
          this.accountService.activeAccount$,
          this.badgeSettingsService.enableBadgeCounter$,
        ),
        mergeMap(async ([tabs, account, enableBadgeCounter]) => {
          if (!account || !enableBadgeCounter) {
            return;
          }

          for (const tab of tabs) {
            await this.setTabState(tab, account.id);
          }
        }),
      )
      .subscribe();
  }

  private async setTabState(tab: Tab, userId: UserId) {
    if (!tab.tabId) {
      this.logService.warning("Tab event received but tab id is undefined");
      return;
    }

    const ciphers = tab.url ? await this.cipherService.getAllDecryptedForUrl(tab.url, userId) : [];
    const cipherCount = ciphers.length;

    if (cipherCount === 0) {
      await this.clearTabState(tab.tabId);
      return;
    }

    const countText = cipherCount > 9 ? "9+" : cipherCount.toString();
    await this.badgeService.setState(
      StateName(tab.tabId),
      BadgeStatePriority.Default,
      {
        text: countText,
      },
      tab.tabId,
    );
  }

  private async clearTabState(tabId: number) {
    await this.badgeService.clearState(StateName(tabId));
  }
}
