import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { Observable, map, of, switchMap } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

import { CurrentAccountComponent } from "../../auth/popup/account-switching/current-account.component";
import { enableAccountSwitching } from "../flags";

@Component({
  selector: "app-header",
  templateUrl: "header.component.html",
  imports: [CommonModule, CurrentAccountComponent],
})
export class HeaderComponent {
  @Input() noTheme = false;
  @Input() hideAccountSwitcher = false;
  authedAccounts$: Observable<boolean>;
  constructor(authService: AuthService) {
    this.authedAccounts$ = authService.authStatuses$.pipe(
      map((record) => Object.values(record)),
      switchMap((statuses) => {
        if (!enableAccountSwitching()) {
          return of(false);
        }

        return of(statuses.some((status) => status !== AuthenticationStatus.LoggedOut));
      }),
    );
  }
}
