// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import {
  combineLatestWith,
  firstValueFrom,
  Observable,
  startWith,
  Subject,
  switchMap,
  takeUntil,
} from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { openUserVerificationPrompt } from "@bitwarden/web-vault/app/auth/shared/components/user-verification";

import { ServiceAccountView } from "../../models/view/service-account.view";
import { AccessTokenView } from "../models/view/access-token.view";
import { ServiceAccountService } from "../service-account.service";

import { AccessService } from "./access.service";
import { AccessTokenCreateDialogComponent } from "./dialogs/access-token-create-dialog.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "sm-access-tokens",
  templateUrl: "./access-tokens.component.html",
  standalone: false,
})
export class AccessTokenComponent implements OnInit, OnDestroy {
  accessTokens$: Observable<AccessTokenView[]>;

  private destroy$ = new Subject<void>();
  private serviceAccountView: ServiceAccountView;

  constructor(
    private route: ActivatedRoute,
    private accessService: AccessService,
    private dialogService: DialogService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private serviceAccountService: ServiceAccountService,
    private toastService: ToastService,
  ) {}

  ngOnInit() {
    this.accessTokens$ = this.accessService.accessToken$.pipe(
      startWith(null),
      combineLatestWith(this.route.params),
      switchMap(async ([_, params]) =>
        this.accessService.getAccessTokens(params.organizationId, params.serviceAccountId),
      ),
    );

    this.serviceAccountService.serviceAccount$
      .pipe(
        startWith(null),
        combineLatestWith(this.route.params),
        switchMap(([_, params]) =>
          this.serviceAccountService.getByServiceAccountId(
            params.serviceAccountId,
            params.organizationId,
          ),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((serviceAccountView) => {
        this.serviceAccountView = serviceAccountView;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected async revoke(tokens: AccessTokenView[]) {
    if (!tokens?.length) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("noAccessTokenSelected"),
      });
      return;
    }

    if (!(await this.verifyUser())) {
      return;
    }

    await this.accessService.revokeAccessTokens(
      this.serviceAccountView.id,
      tokens.map((t) => t.id),
    );

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("accessTokenRevoked"),
    });
  }

  protected openNewAccessTokenDialog() {
    AccessTokenCreateDialogComponent.openNewAccessTokenDialog(
      this.dialogService,
      this.serviceAccountView,
    );
  }

  private verifyUser() {
    const ref = openUserVerificationPrompt(this.dialogService, {
      data: {
        confirmDescription: "revokeAccessTokenDesc",
        confirmButtonText: "revokeAccessToken",
        modalTitle: "revokeAccessToken",
      },
    });

    if (ref == null) {
      return;
    }

    return firstValueFrom(ref.closed);
  }
}
