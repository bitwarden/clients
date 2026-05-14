import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ButtonModule, IconTileComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { RouterService } from "../../../core/router.service";

const RETURN_URL = "/vault";

@Component({
  templateUrl: "./premium-checkout-cancel.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, CommonModule, I18nPipe, IconTileComponent, TypographyModule],
})
export class PremiumCheckoutCancelComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly routerService = inject(RouterService);

  protected readonly AuthenticationStatus = AuthenticationStatus;

  protected readonly authStatus = toSignal(this.authService.activeAccountStatus$, {
    initialValue: null as AuthenticationStatus | null,
  });

  protected readonly returnToBitwarden = async (): Promise<void> => {
    const status = this.authStatus();
    if (status === AuthenticationStatus.Unlocked) {
      await this.router.navigateByUrl(RETURN_URL);
      return;
    }
    await this.routerService.persistLoginRedirectUrl(RETURN_URL);
    if (status === AuthenticationStatus.Locked) {
      await this.router.navigate(["/lock"]);
      return;
    }
    await this.router.navigate(["/login"]);
  };
}
