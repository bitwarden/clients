import { mergeMap, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

import { BadgeService } from "../../platform/badge/badge.service";
import { BadgeIcon } from "../../platform/badge/icon";
import { BadgeStatePriority } from "../../platform/badge/priority";
import { Unset } from "../../platform/badge/state";

const StateName = "auth-status";

export class AuthStatusBadgeUpdaterService {
  constructor(
    private badgeService: BadgeService,
    private accountService: AccountService,
    private authService: AuthService,
  ) {
    this.accountService.activeAccount$
      .pipe(
        switchMap((account) =>
          account
            ? this.authService.authStatusFor$(account.id)
            : of(AuthenticationStatus.LoggedOut),
        ),
        mergeMap(async (authStatus) => {
          switch (authStatus) {
            case AuthenticationStatus.LoggedOut: {
              await this.badgeService.setState(StateName, BadgeStatePriority.High, {
                icon: BadgeIcon.LoggedOut,
                backgroundColor: Unset,
                text: Unset,
              });
              break;
            }
            case AuthenticationStatus.Locked: {
              await this.badgeService.setState(StateName, BadgeStatePriority.High, {
                icon: BadgeIcon.Locked,
                backgroundColor: Unset,
                text: Unset,
              });
              break;
            }
            case AuthenticationStatus.Unlocked: {
              await this.badgeService.setState(StateName, BadgeStatePriority.Low, {
                icon: BadgeIcon.Unlocked,
              });
              break;
            }
          }
        }),
      )
      .subscribe();
  }
}
