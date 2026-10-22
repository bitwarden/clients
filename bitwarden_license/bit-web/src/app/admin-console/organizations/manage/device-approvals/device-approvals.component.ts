import { Component, DestroyRef, OnInit, signal, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { BehaviorSubject, combineLatest, map, merge, shareReplay, switchMap } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { SafeProvider, safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { DevicesIcon } from "@bitwarden/assets/svg";
import { OrganizationAuthRequestApiService } from "@bitwarden/bit-common/admin-console/auth-requests/organization-auth-request-api.service";
import { OrganizationAuthRequestService } from "@bitwarden/bit-common/admin-console/auth-requests/organization-auth-request.service";
import { PendingAuthRequestWithFingerprintView } from "@bitwarden/bit-common/admin-console/auth-requests/pending-auth-request-with-fingerprint.view";
import { PendingAuthRequestView } from "@bitwarden/bit-common/admin-console/auth-requests/pending-auth-request.view";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  TableDataSource,
  StatusLockupComponent,
  ToastService,
  IconModule,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService, LegacyCompatKeyService } from "@bitwarden/legacy-crypto";
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
        LegacyCompatKeyService,
        EncryptService,
        OrganizationUserApiService,
        AccountService,
      ],
    }),
  ] satisfies SafeProvider[],
  imports: [SharedModule, StatusLockupComponent, HeaderModule, IconModule],
})
export class DeviceApprovalsComponent implements OnInit {
  private organizationAuthRequestService = inject(OrganizationAuthRequestService);
  private route = inject(ActivatedRoute);
  private i18nService = inject(I18nService);
  private logService = inject(LogService);
  private validationService = inject(ValidationService);
  private toastService = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  protected tableDataSource = new TableDataSource<PendingAuthRequestWithFingerprintView>();

  protected readonly DevicesIcon = DevicesIcon;

  protected readonly actionInProgress = signal(false);

  protected orgId$ = this.route.params.pipe(
    map((params): OrganizationId => params.organizationId as OrganizationId),
  );

  private refresh$ = new BehaviorSubject<void>(undefined);

  protected requests$ = combineLatest([this.orgId$, this.refresh$]).pipe(
    switchMap(([organizationId]) =>
      this.organizationAuthRequestService.listPendingRequestsWithFingerprint(organizationId),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected loading$ = merge(
    combineLatest([this.orgId$, this.refresh$]).pipe(map(() => true)),
    this.requests$.pipe(map(() => false)),
  );

  async ngOnInit() {
    this.requests$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((r) => {
      this.tableDataSource.data = r;
    });
  }

  async approveRequest(organizationId: OrganizationId, authRequest: PendingAuthRequestView) {
    await this.withActionInProgress(async () => {
      try {
        await this.organizationAuthRequestService.approvePendingRequest(
          organizationId,
          authRequest,
        );
        this.refresh$.next();
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("loginRequestApproved"),
        });
      } catch (err: unknown) {
        this.logService.error(String(err));
        this.validationService.showError(err);
      }
    });
  }

  async approveAllRequests(organizationId: OrganizationId) {
    if (this.tableDataSource.data.length === 0) {
      return;
    }

    await this.withActionInProgress(async () => {
      try {
        await this.organizationAuthRequestService.approvePendingRequests(
          organizationId,
          this.tableDataSource.data,
        );
        this.refresh$.next();
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("allLoginRequestsApproved"),
        });
      } catch (err: unknown) {
        this.logService.error(String(err));
        this.validationService.showError(err);
      }
    });
  }

  async denyRequest(organizationId: OrganizationId, requestId: string) {
    await this.withActionInProgress(async () => {
      try {
        await this.organizationAuthRequestService.denyPendingRequests(organizationId, requestId);
        this.refresh$.next();
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("loginRequestDenied"),
        });
      } catch (err: unknown) {
        this.logService.error(String(err));
        this.validationService.showError(err);
      }
    });
  }

  async denyAllRequests(organizationId: OrganizationId) {
    if (this.tableDataSource.data.length === 0) {
      return;
    }

    await this.withActionInProgress(async () => {
      try {
        await this.organizationAuthRequestService.denyPendingRequests(
          organizationId,
          ...this.tableDataSource.data.map((r) => r.id),
        );
        this.refresh$.next();
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("allLoginRequestsDenied"),
        });
      } catch (err: unknown) {
        this.logService.error(String(err));
        this.validationService.showError(err);
      }
    });
  }

  private async withActionInProgress(action: () => Promise<void>) {
    if (this.actionInProgress()) {
      return;
    }

    this.actionInProgress.set(true);
    try {
      await action();
    } finally {
      this.actionInProgress.set(false);
    }
  }
}
