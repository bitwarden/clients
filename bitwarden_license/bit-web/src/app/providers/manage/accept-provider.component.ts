import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  signal,
} from "@angular/core";
import { ActivatedRoute, Params, Router, RouterLink } from "@angular/router";

import { BitwardenLogo } from "@bitwarden/assets/svg";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ProviderUserAcceptRequest } from "@bitwarden/common/provider";
import { ButtonModule, IconComponent, SvgModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { BaseAcceptComponent } from "@bitwarden/web-vault/app/common/base.accept.component";

@Component({
  selector: "app-accept-provider",
  templateUrl: "accept-provider.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    SvgModule,
    TypographyModule,
    ButtonModule,
    IconComponent,
    I18nPipe,
  ],
})
export class AcceptProviderComponent extends BaseAcceptComponent {
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly logo = BitwardenLogo;
  protected readonly providerName = signal("");
  private readonly providerId = signal("");
  private readonly providerUserId = signal("");
  private readonly providerInviteToken = signal("");

  readonly failedMessage = "providerInviteAcceptFailed";

  readonly requiredParameters = ["providerId", "providerUserId", "token"];

  constructor(
    router: Router,
    i18nService: I18nService,
    route: ActivatedRoute,
    authService: AuthService,
    private readonly apiService: ApiService,
    platformUtilService: PlatformUtilsService,
  ) {
    super(router, platformUtilService, i18nService, route, authService);
  }

  async authedHandler(qParams: Params) {
    const request = new ProviderUserAcceptRequest({ token: qParams.token });

    await this.apiService.postProviderUserAccept(
      qParams.providerId,
      qParams.providerUserId,
      request,
    );

    this.platformUtilService.showToast(
      "success",
      this.i18nService.t("inviteAccepted"),
      this.i18nService.t("providerInviteAcceptedDesc"),
      { timeout: 10000 },
    );
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/vault"]);
  }

  async unauthedHandler(qParams: Params) {
    this.providerName.set(qParams.providerName ?? "");
    this.providerId.set(qParams.providerId);
    this.providerUserId.set(qParams.providerUserId);
    this.providerInviteToken.set(qParams.token);
    // The base class clears `loading` after this handler returns, outside any template event,
    // so under OnPush the view has to be marked for the next check to render the invitation.
    this.cdr.markForCheck();
  }

  async register() {
    // We don't need users to complete email verification if they are coming directly from an emailed invite.
    // Therefore, we skip /signup and navigate directly to /finish-signup.
    await this.router.navigate(["/finish-signup"], {
      queryParams: {
        email: this.email,
        providerUserId: this.providerUserId(),
        providerInviteToken: this.providerInviteToken(),
      },
    });
  }
}
