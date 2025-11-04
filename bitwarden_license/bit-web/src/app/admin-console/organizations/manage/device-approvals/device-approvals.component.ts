// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { BehaviorSubject, Subject, switchMap, takeUntil, tap } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { SafeProvider, safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { DevicesIcon } from "@bitwarden/assets/svg";
import { OrganizationAuthRequestApiService } from "@bitwarden/bit-common/admin-console/auth-requests/organization-auth-request-api.service";
import { OrganizationAuthRequestService } from "@bitwarden/bit-common/admin-console/auth-requests/organization-auth-request.service";
import { PendingAuthRequestWithFingerprintView } from "@bitwarden/bit-common/admin-console/auth-requests/pending-auth-request-with-fingerprint.view";
import { PendingAuthRequestView } from "@bitwarden/bit-common/admin-console/auth-requests/pending-auth-request.view";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { TableDataSource, NoItemsModule, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared/shared.module";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-org-device-approvals",
  templateUrl: "./device-approvals.component.html",
  providers: [
    safeProvider({
      provide: OrganizationAuthRequestApiService,
      deps: [ApiService],
    }),
    safeProvider({
      provide: OrganizationAuthRequestService,
      deps: [
        OrganizationAuthRequestApiService,
        KeyService,
        EncryptService,
        OrganizationUserApiService,
        AccountService,
      ],
    }),
  ] satisfies SafeProvider[],
  imports: [SharedModule, NoItemsModule, HeaderModule],
})
export class DeviceApprovalsComponent implements OnInit, OnDestroy {
  tableDataSource = new TableDataSource<PendingAuthRequestWithFingerprintView>();
  organizationId: string;
  loading = true;
  actionInProgress = false;

  protected readonly DevicesIcon = DevicesIcon;

  private destroy$ = new Subject<void>();
  private refresh$ = new BehaviorSubject<void>(null);

  constructor(
    private organizationAuthRequestService: OrganizationAuthRequestService,
    private route: ActivatedRoute,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private logService: LogService,
    private validationService: ValidationService,
    private configService: ConfigService,
    private toastService: ToastService,
  ) {}

  async ngOnInit() {
    this.route.params
      .pipe(
        tap((params) => (this.organizationId = params.organizationId)),
        switchMap(() =>
          this.refresh$.pipe(
            tap(() => (this.loading = true)),
            switchMap(() =>
              this.organizationAuthRequestService.listPendingRequestsWithFingerprint(
                this.organizationId,
              ),
            ),
          ),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((r) => {
        this.tableDataSource.data = r;
        this.loading = false;
      });
  }

  async approveRequest(authRequest: PendingAuthRequestView) {
    await this.performAsyncAction(async () => {
      try {
        await this.organizationAuthRequestService.approvePendingRequest(
          this.organizationId,
          authRequest,
        );

        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t("loginRequestApproved"),
        });
        // FIXME: Remove when updating file. Eslint update
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        this.toastService.showToast({
          variant: "error",
          title: null,
          message: this.i18nService.t("resetPasswordDetailsError"),
        });
      }
    });
  }

  async approveAllRequests() {
    if (this.tableDataSource.data.length === 0) {
      return;
    }

    await this.performAsyncAction(async () => {
      await this.organizationAuthRequestService.approvePendingRequests(
        this.organizationId,
        this.tableDataSource.data,
      );
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("allLoginRequestsApproved"),
      });
    });
  }

  async denyRequest(requestId: string) {
    await this.performAsyncAction(async () => {
      await this.organizationAuthRequestService.denyPendingRequests(this.organizationId, requestId);
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("loginRequestDenied"),
      });
    });
  }

  async denyAllRequests() {
    if (this.tableDataSource.data.length === 0) {
      return;
    }

    await this.performAsyncAction(async () => {
      await this.organizationAuthRequestService.denyPendingRequests(
        this.organizationId,
        ...this.tableDataSource.data.map((r) => r.id),
      );
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("allLoginRequestsDenied"),
      });
    });
  }

  private async performAsyncAction(action: () => Promise<void>) {
    if (this.actionInProgress) {
      return;
    }
    this.actionInProgress = true;
    try {
      await action();
      this.refresh$.next();
    } catch (err: unknown) {
      this.logService.error(err.toString());
      this.validationService.showError(err);
    } finally {
      this.actionInProgress = false;
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
