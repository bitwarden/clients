import { combineLatest, distinctUntilChanged, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";

import { BadgeService } from "../../platform/badge/badge.service";
import { BadgeStatePriority } from "../../platform/badge/priority";

const StateName = "clipboard-notification-badge";

export class ClipboardNotificationBadgeUpdaterService {
  constructor(
    private badgeService: BadgeService,
    private accountService: AccountService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
  ) {}

  async init(): Promise<void> {
    this.badgeService.setState(StateName, () => {
      return combineLatest({
        account: this.accountService.activeAccount$,
        shouldShow:
          this.autofillSettingsService.showClipboardSettingUpdateNotification$.pipe(
            distinctUntilChanged(),
          ),
      }).pipe(
        map(({ account, shouldShow }) => {
          if (!account || !shouldShow) {
            return undefined;
          }

          return {
            state: {
              text: "1",
              color: "#ff0000",
            },
            priority: BadgeStatePriority.Default,
          };
        }),
      );
    });
  }
}
