// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DestroyRef, Directive, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { first, switchMap } from "rxjs/operators";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

@Directive()
export abstract class BaseAcceptComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  loading = true;
  authed = false;
  email: string;
  actionPromise: Promise<any>;

  protected requiredParameters: string[] = [];
  protected failedShortMessage = "inviteAcceptFailedShort";
  protected failedMessage = "inviteAcceptFailed";

  constructor(
    protected router: Router,
    protected platformUtilService: PlatformUtilsService,
    protected i18nService: I18nService,
    protected route: ActivatedRoute,
    protected authService: AuthService,
  ) {}

  abstract authedHandler(qParams: Params): Promise<void>;

  abstract unauthedHandler(qParams: Params): Promise<void>;

  async ngOnInit() {
    this.route.queryParams
      .pipe(
        first(),
        switchMap(async (qParams) => {
          let error = this.requiredParameters.some(
            (e) => qParams?.[e] == null || qParams[e] === "",
          );
          let errorMessage: string = null;
          if (!error) {
            this.email = qParams.email;

            const status = await firstValueFrom(this.authService.activeAccountStatus$);
            if (status !== AuthenticationStatus.LoggedOut) {
              try {
                await this.authedHandler(qParams);
              } catch (e) {
                error = true;
                errorMessage = e.message;
              }
            } else {
              await this.unauthedHandler(qParams);
            }
          }

          if (error) {
            const message =
              errorMessage != null
                ? this.i18nService.t(this.failedShortMessage, errorMessage)
                : this.i18nService.t(this.failedMessage);
            this.platformUtilService.showToast("error", null, message, { timeout: 10000 });
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.router.navigate(["/"]);
          }

          this.loading = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
