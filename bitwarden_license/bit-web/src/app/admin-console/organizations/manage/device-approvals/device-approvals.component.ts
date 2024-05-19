import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { BehaviorSubject, Subject, switchMap, takeUntil, tap } from "rxjs";

import { SafeProvider, safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { OrganizationAuthRequestApiService } from "@bitwarden/bit-common/admin-console/auth-requests/organization-auth-request-api.service";
import { OrganizationAuthRequestService } from "@bitwarden/bit-common/admin-console/auth-requests/organization-auth-request.service";
import { PendingAuthRequestView } from "@bitwarden/bit-common/admin-console/auth-requests/pending-auth-request.view";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationUserService } from "@bitwarden/common/admin-console/abstractions/organization-user/organization-user.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { TableDataSource, NoItemsModule } from "@bitwarden/components";
import { Devices } from "@bitwarden/web-vault/app/admin-console/icons";
import { LooseComponentsModule } from "@bitwarden/web-vault/app/shared";
import { SharedModule } from "@bitwarden/web-vault/app/shared/shared.module";

@Component({
  selector: "app-org-device-approvals",
  templateUrl: "./device-approvals.component.html",
  standalone: true,
  providers: [
    safeProvider({
      provide: OrganizationAuthRequestApiService,
      deps: [ApiService],
    }),
    safeProvider({
      provide: OrganizationAuthRequestService,
      deps: [OrganizationAuthRequestApiService, CryptoService, OrganizationUserService],
    }),
  ] satisfies SafeProvider[],
  imports: [SharedModule, NoItemsModule, LooseComponentsModule],
})
export class DeviceApprovalsComponent implements OnInit, OnDestroy {
  tableDataSource = new TableDataSource<PendingAuthRequestView>();
  organizationId: string;
  loading = true;
  actionInProgress = false;

  protected readonly Devices = Devices;

  private destroy$ = new Subject<void>();
  private refresh$ = new BehaviorSubject<void>(null);

  constructor(
    private organizationAuthRequestService: OrganizationAuthRequestService,
    private route: ActivatedRoute,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private logService: LogService,
    private validationService: ValidationService,
  ) {}

  async ngOnInit() {
    this.route.params
      .pipe(
        tap((params) => (this.organizationId = params.organizationId)),
        switchMap(() =>
          this.refresh$.pipe(
            tap(() => (this.loading = true)),
            switchMap(() =>
              this.organizationAuthRequestService.listPendingRequests(this.organizationId),
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

        this.platformUtilsService.showToast(
          "success",
          null,
          this.i18nService.t("loginRequestApproved"),
        );
      } catch (error) {
        this.platformUtilsService.showToast(
          "error",
          null,
          this.i18nService.t("resetPasswordDetailsError"),
        );
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
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("allLoginRequestsApproved"),
      );
    });
  }

  async denyRequest(requestId: string) {
    await this.performAsyncAction(async () => {
      await this.organizationAuthRequestService.denyPendingRequests(this.organizationId, requestId);
      this.platformUtilsService.showToast("error", null, this.i18nService.t("loginRequestDenied"));
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
      this.platformUtilsService.showToast(
        "error",
        null,
        this.i18nService.t("allLoginRequestsDenied"),
      );
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
