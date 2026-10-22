// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule, Location } from "@angular/common";
import { Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { Observable, combineLatest, of, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-current-account",
  templateUrl: "current-account.component.html",
  imports: [CommonModule, JslibModule, AvatarModule, RouterModule],
})
export class CurrentAccountComponent {
  currentAccount$: Observable<CurrentAccount>;

  /**
   * TODO: remove with the VFO1Foundation flag.
   *
   * Optional so that reading the flag doesn't force a `ConfigService` stub into every spec that
   * renders a page header. Always present in the running extension.
   */
  private readonly configService = inject(ConfigService, { optional: true });

  /** TODO: remove with the VFO1Foundation flag. */
  protected readonly vfo1Enabled = toSignal(
    this.configService?.getFeatureFlag$(FeatureFlag.VFO1Foundation) ?? of(false),
    { initialValue: false },
  );

  /**
   * TODO: remove with the VFO1Foundation flag, along with the `[class]` binding it feeds.
   *
   * The legacy header under-pads its trailing edge for icon buttons; the avatar isn't one, so it
   * offsets itself. The app bar pads and centers the row itself.
   */
  protected readonly wrapperClasses = computed(() => (this.vfo1Enabled() ? "" : "tw-me-2 tw-mt-1"));

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
