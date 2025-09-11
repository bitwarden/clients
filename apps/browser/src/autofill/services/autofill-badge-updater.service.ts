import {
  combineLatest,
  delay,
  distinctUntilChanged,
  merge,
  mergeMap,
  Observable,
  of,
  switchMap,
  withLatestFrom,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BadgeSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/badge-settings.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { Tab } from "../../platform/badge/badge-browser-api";
import { BadgeService, StateSetting } from "../../platform/badge/badge.service";
import { BadgeStatePriority } from "../../platform/badge/priority";

const StateName = "autofill-badge-updater";

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

    this.badgeService.setDynamicState(StateName, (activeTabsUpdated$, activeTabs$) => {
      const stateChangedObservable$: Observable<StateSetting[]> = combineLatest({
        account: this.accountService.activeAccount$,
        enableBadgeCounter:
          this.badgeSettingsService.enableBadgeCounter$.pipe(distinctUntilChanged()),
        ciphers: ciphers$.pipe(delay(100)), // Delay to allow cipherService.getAllDecryptedForUrl to pick up changes
      }).pipe(
        withLatestFrom(activeTabs$),
        mergeMap(async ([{ account, enableBadgeCounter }, tabs]) => {
          if (!account) {
            return [];
          }

          return await Promise.all(
            tabs.map(async (tab) => {
              if (enableBadgeCounter) {
                return {
                  state: {
                    text: await this.calculateCountText(tab, account.id),
                  },
                  priority: BadgeStatePriority.Default,
                  tabId: tab.tabId,
                };
              } else {
                // Explicitly emit empty state for tab to clear any existing badge
                return {
                  state: {},
                  priority: BadgeStatePriority.Default,
                  tabId: tab.tabId,
                };
              }
            }),
          );
        }),
      );

      const tabUpdatedObservable$: Observable<StateSetting[]> = activeTabsUpdated$.pipe(
        withLatestFrom(
          this.accountService.activeAccount$,
          this.badgeSettingsService.enableBadgeCounter$,
        ),
        mergeMap(async ([tabs, account, enableBadgeCounter]) => {
          if (!account || !enableBadgeCounter) {
            return [];
          }

          return await Promise.all(
            tabs.map(async (tab) => {
              return {
                state: {
                  text: await this.calculateCountText(tab, account.id),
                },
                priority: BadgeStatePriority.Default,
                tabId: tab.tabId,
              };
            }),
          );
        }),
      );

      return merge(stateChangedObservable$, tabUpdatedObservable$);
    });
  }

  private async calculateCountText(tab: Tab, userId: UserId) {
    if (!tab.tabId) {
      this.logService.warning("Tab event received but tab id is undefined");
      return;
    }

    const ciphers = tab.url ? await this.cipherService.getAllDecryptedForUrl(tab.url, userId) : [];
    const cipherCount = ciphers.length;

    if (cipherCount === 0) {
      return undefined;
    }

    return cipherCount > 9 ? "9+" : cipherCount.toString();
  }
}
