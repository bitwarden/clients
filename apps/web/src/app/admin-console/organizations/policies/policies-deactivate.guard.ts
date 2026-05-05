import { Injectable } from "@angular/core";
import { CanDeactivate } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getUserId } from "@bitwarden/common/auth/services/account.service";

// `import type` avoids a circular runtime dependency: the guard only needs
// PoliciesComponent as a TypeScript type (for the CanDeactivate generic and
// the canDeactivate() parameter), never as a runtime value.
import type { PoliciesComponent } from "./policies.component";

@Injectable({ providedIn: "root" })
export class PoliciesDeactivateGuard implements CanDeactivate<PoliciesComponent> {
  constructor(
    private readonly accountService: AccountService,
    private readonly authService: AuthService,
  ) {}

  async canDeactivate(component: PoliciesComponent): Promise<boolean> {
    // If the user is already locked or logged out (e.g. during a lock/logout flow),
    // always allow navigation so the discard-edits dialog is never shown.
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const status = await firstValueFrom(this.authService.authStatusFor$(userId));
    if (status !== AuthenticationStatus.Unlocked) {
      return true;
    }
    return component.canDeactivate();
  }
}
