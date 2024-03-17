import { Location } from "@angular/common";
import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Observable, combineLatest, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserId } from "@bitwarden/common/types/guid";

export type CurrentAccount = {
  id: UserId;
  name: string | undefined;
  email: string;
  status: AuthenticationStatus;
  avatarColor: string;
};

@Component({
  selector: "app-current-account",
  templateUrl: "current-account.component.html",
})
export class CurrentAccountComponent {
  currentAccount$: Observable<CurrentAccount>;

  constructor(
    private accountService: AccountService,
    private avatarService: AvatarService,
    private router: Router,
    private location: Location,
    private route: ActivatedRoute,
  ) {
    this.currentAccount$ = combineLatest([
      this.accountService.activeAccount$,
      this.avatarService.avatarColor$,
    ]).pipe(
      switchMap(async ([account, avatarColor]) => {
        if (account == null) {
          return null;
        }
        const currentAccount: CurrentAccount = {
          id: account.id,
          name: account.name || account.email,
          email: account.email,
          status: account.status,
          avatarColor,
        };

        return currentAccount;
      }),
    );
  }

  async currentAccountClicked() {
    if (this.route.snapshot.data.state.includes("account-switcher")) {
      this.location.back();
    } else {
      await this.router.navigate(["/account-switcher"]);
    }
  }
}
