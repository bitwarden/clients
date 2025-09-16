import { combineLatest, delay, distinctUntilChanged, mergeMap, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BadgeSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/badge-settings.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { Tab } from "../../platform/badge/badge-browser-api";
import { BadgeService } from "../../platform/badge/badge.service";
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

    this.badgeService.setState(StateName, (tab) => {
      return combineLatest({
        account: this.accountService.activeAccount$,
        enableBadgeCounter:
          this.badgeSettingsService.enableBadgeCounter$.pipe(distinctUntilChanged()),
        ciphers: ciphers$.pipe(delay(100)), // Delay to allow cipherService.getAllDecryptedForUrl to pick up changes
      }).pipe(
        mergeMap(async ({ account, enableBadgeCounter }) => {
          if (!account || !enableBadgeCounter) {
            return undefined;
          }

          return {
            state: {
              text: await this.calculateCountText(tab, account.id),
            },
            priority: BadgeStatePriority.Default,
          };
        }),
      );
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
