import { mergeMap, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

import { BadgeService } from "../../platform/badge/badge.service";
import { BadgeStatePriority } from "../../platform/badge/priority";
import { IconPaths, Unset } from "../../platform/badge/state";

const StateName = "auth-status";

const LoggedOutIcon: IconPaths = {
  19: "/images/icon19_gray.png",
  38: "/images/icon38_gray.png",
};

const LockedIcon: IconPaths = {
  19: "/images/icon19_locked.png",
  38: "/images/icon38_locked.png",
};

const UnlockedIcon: IconPaths = {
  19: "/images/icon19.png",
  38: "/images/icon38.png",
};

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
                icon: LoggedOutIcon,
                backgroundColor: Unset,
                text: Unset,
              });
              break;
            }
            case AuthenticationStatus.Locked: {
              await this.badgeService.setState(StateName, BadgeStatePriority.High, {
                icon: LockedIcon,
                backgroundColor: Unset,
                text: Unset,
              });
              break;
            }
            case AuthenticationStatus.Unlocked: {
              await this.badgeService.setState(StateName, BadgeStatePriority.Low, {
                icon: UnlockedIcon,
              });
              break;
            }
          }
        }),
      )
      .subscribe();
  }
}
