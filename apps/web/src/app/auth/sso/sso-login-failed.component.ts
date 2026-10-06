import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AnonLayoutWrapperDataService,
  ButtonModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { getSsoLoginFailedUi } from "./get-sso-login-failed-ui.func";
import { isSsoLoginFailedErrorKind } from "./sso-login-failed-error-kind.type";

/**
 * Terminal page for SSO-login failure states. Reads a `kind` query param to
 * pick the variant; chrome + body-copy mapping lives in `getSsoLoginFailedUi`,
 * which also declares any query-param placeholders each variant needs.
 * An unrecognized or missing `kind` redirects to /login.
 */
@Component({
  templateUrl: "sso-login-failed.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, RouterLink, TypographyModule, I18nPipe],
})
export class SsoLoginFailedComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly anonLayoutWrapperDataService = inject(AnonLayoutWrapperDataService);
  private readonly i18nService = inject(I18nService);

  protected readonly bodyMessage = signal<string>("");

  async ngOnInit(): Promise<void> {
    const qParams = await firstValueFrom(this.route.queryParams);
    if (!isSsoLoginFailedErrorKind(qParams.kind)) {
      await this.router.navigate(["/login"]);
      return;
    }
    const ui = getSsoLoginFailedUi(qParams.kind, qParams);
    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData(ui.anonLayoutData);
    this.bodyMessage.set(
      this.i18nService.t(ui.bodyMessage.key, ...(ui.bodyMessage.placeholders ?? [])),
    );
  }
}
