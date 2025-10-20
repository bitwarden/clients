// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule, Location } from "@angular/common";
import { Component } from "@angular/core";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { Observable, combineLatest, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserId } from "@bitwarden/common/types/guid";
import { AvatarModule } from "@bitwarden/components";

export type CurrentAccount = {
  id: UserId;
  name: string | undefined;
  email: string;
  status: AuthenticationStatus;
  avatarColor: string;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
 
@Component({
  selector: "app-current-account",
  templateUrl: "current-account.component.html",
  imports: [CommonModule, JslibModule, AvatarModule, RouterModule],
})
export class CurrentAccountComponent {
  currentAccount$: Observable<CurrentAccount>;

  constructor(
    private accountService: AccountService,
    private avatarService: AvatarService,
    private router: Router,
    private location: Location,
    private route: ActivatedRoute,
    private authService: AuthService,
  ) {
    this.currentAccount$ = combineLatest([
      this.accountService.activeAccount$,
      this.avatarService.avatarColor$,
      this.authService.activeAccountStatus$,
    ]).pipe(
      switchMap(async ([account, avatarColor, accountStatus]) => {
        if (account == null) {
          return null;
        }
        const currentAccount: CurrentAccount = {
          id: account.id,
          name: account.name || account.email,
          email: account.email,
          status: accountStatus,
          avatarColor,
        };

        return currentAccount;
      }),
    );
  }

  async currentAccountClicked() {
    if (this.route.snapshot.data?.state?.includes("account-switcher")) {
      this.location.back();
    } else {
      await this.router.navigate(["/account-switcher"]);
    }
  }
}
