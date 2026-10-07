import { CommonModule } from "@angular/common";
import { Component, DestroyRef, inject, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import {
  combineLatest,
  concatMap,
  firstValueFrom,
  map,
  Observable,
  shareReplay,
  switchMap,
  withLatestFrom,
} from "rxjs";

import { DomainIcon } from "@bitwarden/assets/svg";
import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import { OrgDomainServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain.service.abstraction";
import { OrganizationDomainResponse } from "@bitwarden/common/admin-console/abstractions/organization-domain/responses/organization-domain.response";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { HttpStatusCode } from "@bitwarden/common/enums";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  A11yTitleDirective,
  BadgeModule,
  ButtonModule,
  DialogService,
  IconModule,
  LinkModule,
  MenuModule,
  StatusLockupComponent,
  SvgModule,
  TableModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import {
  DomainAddEditDialogComponent,
  DomainAddEditDialogData,
} from "./domain-add-edit-dialog/domain-add-edit-dialog.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-org-manage-domain-verification",
  templateUrl: "domain-verification.component.html",
  imports: [
    CommonModule,
    HeaderModule,
    ButtonModule,
    TypographyModule,
    LinkModule,
    A11yTitleDirective,
    TableModule,
    BadgeModule,
    MenuModule,
    IconModule,
    StatusLockupComponent,
    SvgModule,
    I18nPipe,
  ],
})
export class DomainVerificationComponent implements OnInit {
  protected domainIcon = DomainIcon;

  private route = inject(ActivatedRoute);
  private i18nService = inject(I18nService);
  private orgDomainApiService = inject(OrgDomainApiServiceAbstraction);
  private orgDomainService = inject(OrgDomainServiceAbstraction);
  private dialogService = inject(DialogService);
  private validationService = inject(ValidationService);
  private toastService = inject(ToastService);
  private policyService = inject(PolicyService);
  private accountService = inject(AccountService);
  private destroyRef = inject(DestroyRef);

  readonly orgDomains$ = this.orgDomainService.orgDomains$;

  readonly organizationId$: Observable<OrganizationId> = this.route.params.pipe(
    map((params) => params.organizationId),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private readonly userId$ = this.accountService.activeAccount$.pipe(getUserId);

  private readonly singleOrgPolicyEnabled$ = this.userId$.pipe(
    switchMap((userId) => this.policyService.policies$(userId)),
    withLatestFrom(this.organizationId$),
    map(
      ([policies, organizationId]) =>
        policies.find((p) => p.type === PolicyType.SingleOrg && p.organizationId === organizationId)
          ?.enabled ?? false,
    ),
  );

  readonly loading = signal(true);

  ngOnInit() {
    this.organizationId$
      .pipe(
        concatMap((organizationId) => this.orgDomainApiService.getAllByOrgId(organizationId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.loading.set(false));
  }

  async addDomain(organizationId: OrganizationId) {
    const domainAddEditDialogData: DomainAddEditDialogData = {
      organizationId: organizationId,
      orgDomain: undefined,
      existingDomainNames: await this.getExistingDomainNames(),
    };

    const showSingleOrgWarning = await firstValueFrom(
      combineLatest([this.orgDomains$, this.singleOrgPolicyEnabled$]).pipe(
        map(
          ([organizationDomains, singleOrgPolicyEnabled]) =>
            !singleOrgPolicyEnabled &&
            organizationDomains.every((domain) => domain.verifiedDate === null),
        ),
      ),
    );

    if (showSingleOrgWarning) {
      await this.dialogService.openSimpleDialog({
        title: { key: "claim-domain-single-org-warning" },
        content: { key: "single-org-revoked-user-warning" },
        cancelButtonText: { key: "cancel" },
        acceptButtonText: { key: "confirm" },
        acceptAction: () => this.openAddDomainDialog(domainAddEditDialogData),
        type: "info",
      });

      return;
    }

    await this.openAddDomainDialog(domainAddEditDialogData);
  }

  private async openAddDomainDialog(domainAddEditDialogData: DomainAddEditDialogData) {
    this.dialogService.open(DomainAddEditDialogComponent, {
      data: domainAddEditDialogData,
    });
  }

  async editDomain(organizationId: OrganizationId, orgDomain: OrganizationDomainResponse) {
    const domainAddEditDialogData: DomainAddEditDialogData = {
      organizationId: organizationId,
      orgDomain: orgDomain,
      existingDomainNames: await this.getExistingDomainNames(),
    };

    this.dialogService.open(DomainAddEditDialogComponent, {
      data: domainAddEditDialogData,
    });
  }

  private async getExistingDomainNames(): Promise<string[]> {
    const orgDomains = await firstValueFrom(this.orgDomains$);
    return orgDomains.map((o) => o.domainName);
  }

  copyDnsTxt(dnsTxt: string): void {
    this.orgDomainService.copyDnsTxt(dnsTxt);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("valueCopied", this.i18nService.t("dnsTxtRecord")),
    });
  }

  async verifyDomain(
    organizationId: OrganizationId,
    orgDomainId: string,
    domainName: string,
  ): Promise<void> {
    try {
      const orgDomain: OrganizationDomainResponse = await this.orgDomainApiService.verify(
        organizationId,
        orgDomainId,
      );

      if (orgDomain.verifiedDate) {
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("domainClaimed"),
        });
      } else {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("domainNotClaimed", domainName),
        });
        // Update this item so the last checked date gets updated.
        await this.updateOrgDomain(organizationId, orgDomainId);
      }
    } catch (e) {
      this.handleVerifyDomainError(e, domainName);
      // Update this item so the last checked date gets updated.
      await this.updateOrgDomain(organizationId, orgDomainId);
    }
  }

  private async updateOrgDomain(organizationId: OrganizationId, orgDomainId: string) {
    // Update this item so the last checked date gets updated.
    await this.orgDomainApiService.getByOrgIdAndOrgDomainId(organizationId, orgDomainId);
  }

  private handleVerifyDomainError(e: unknown, domainName: string): void {
    if (e instanceof ErrorResponse) {
      const errorResponse: ErrorResponse = e as ErrorResponse;
      switch (errorResponse.statusCode) {
        case HttpStatusCode.Conflict:
          if (errorResponse.message.includes("The domain is not available to be claimed")) {
            this.toastService.showToast({
              variant: "error",
              message: this.i18nService.t("domainNotAvailable", domainName),
            });
          }
          break;

        default:
          this.validationService.showError(errorResponse);
          break;
      }
    }
  }

  async deleteDomain(organizationId: OrganizationId, orgDomainId: string): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "removeDomain" },
      content: { key: "removeDomainWarning" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    await this.orgDomainApiService.delete(organizationId, orgDomainId);

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("domainRemoved"),
    });
  }
}
