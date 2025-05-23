// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Params } from "@angular/router";
import {
  concatMap,
  firstValueFrom,
  map,
  Observable,
  Subject,
  switchMap,
  take,
  takeUntil,
} from "rxjs";

import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import { OrgDomainServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain.service.abstraction";
import { OrganizationDomainResponse } from "@bitwarden/common/admin-console/abstractions/organization-domain/responses/organization-domain.response";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { HttpStatusCode } from "@bitwarden/common/enums";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DialogService, ToastService } from "@bitwarden/components";

import {
  DomainAddEditDialogComponent,
  DomainAddEditDialogData,
} from "./domain-add-edit-dialog/domain-add-edit-dialog.component";

@Component({
  selector: "app-org-manage-domain-verification",
  templateUrl: "domain-verification.component.html",
  standalone: false,
})
export class DomainVerificationComponent implements OnInit, OnDestroy {
  private componentDestroyed$ = new Subject<void>();
  private singleOrgPolicyEnabled = false;

  loading = true;

  organizationId: string;
  orgDomains$: Observable<OrganizationDomainResponse[]>;

  constructor(
    private route: ActivatedRoute,
    private i18nService: I18nService,
    private orgDomainApiService: OrgDomainApiServiceAbstraction,
    private orgDomainService: OrgDomainServiceAbstraction,
    private dialogService: DialogService,
    private validationService: ValidationService,
    private toastService: ToastService,
    private configService: ConfigService,
    private policyService: PolicyService,
    private accountService: AccountService,
  ) {}

  async ngOnInit() {
    this.orgDomains$ = this.orgDomainService.orgDomains$;

    // Note: going to use concatMap as async subscribe blocks don't work as you expect and
    // as such, ESLint rejects it
    // ex: https://stackoverflow.com/a/71056380
    this.route.params
      .pipe(
        concatMap(async (params: Params) => {
          this.organizationId = params.organizationId;
          await this.load();
        }),
        takeUntil(this.componentDestroyed$),
      )
      .subscribe();
  }

  async load() {
    await this.orgDomainApiService.getAllByOrgId(this.organizationId);

    const singleOrgPolicy = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => this.policyService.policies$(userId)),
        map((policies) =>
          policies.find(
            (p) => p.type === PolicyType.SingleOrg && p.organizationId === this.organizationId,
          ),
        ),
      ),
    );
    this.singleOrgPolicyEnabled = singleOrgPolicy?.enabled ?? false;

    this.loading = false;
  }

  async addDomain() {
    const domainAddEditDialogData: DomainAddEditDialogData = {
      organizationId: this.organizationId,
      orgDomain: null,
      existingDomainNames: this.getExistingDomainNames(),
    };

    const showSingleOrgWarning = await firstValueFrom(
      this.orgDomains$.pipe(
        map(
          (organizationDomains) =>
            !this.singleOrgPolicyEnabled &&
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

  editDomain(orgDomain: OrganizationDomainResponse) {
    const domainAddEditDialogData: DomainAddEditDialogData = {
      organizationId: this.organizationId,
      orgDomain: orgDomain,
      existingDomainNames: this.getExistingDomainNames(),
    };

    this.dialogService.open(DomainAddEditDialogComponent, {
      data: domainAddEditDialogData,
    });
  }

  private getExistingDomainNames(): Array<string> {
    let existingDomainNames: string[];
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    this.orgDomains$.pipe(take(1)).subscribe((orgDomains: Array<OrganizationDomainResponse>) => {
      existingDomainNames = orgDomains.map((o) => o.domainName);
    });
    return existingDomainNames;
  }

  // Options

  copyDnsTxt(dnsTxt: string): void {
    this.orgDomainService.copyDnsTxt(dnsTxt);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("valueCopied", this.i18nService.t("dnsTxtRecord")),
    });
  }

  async verifyDomain(orgDomainId: string, domainName: string): Promise<void> {
    try {
      const orgDomain: OrganizationDomainResponse = await this.orgDomainApiService.verify(
        this.organizationId,
        orgDomainId,
      );

      if (orgDomain.verifiedDate) {
        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t("domainClaimed"),
        });
      } else {
        this.toastService.showToast({
          variant: "error",
          title: null,
          message: this.i18nService.t("domainNotClaimed", domainName),
        });
        // Update this item so the last checked date gets updated.
        await this.updateOrgDomain(orgDomainId);
      }
    } catch (e) {
      this.handleVerifyDomainError(e, domainName);
      // Update this item so the last checked date gets updated.
      await this.updateOrgDomain(orgDomainId);
    }
  }

  private async updateOrgDomain(orgDomainId: string) {
    // Update this item so the last checked date gets updated.
    await this.orgDomainApiService.getByOrgIdAndOrgDomainId(this.organizationId, orgDomainId);
  }

  private handleVerifyDomainError(e: any, domainName: string): void {
    if (e instanceof ErrorResponse) {
      const errorResponse: ErrorResponse = e as ErrorResponse;
      switch (errorResponse.statusCode) {
        case HttpStatusCode.Conflict:
          if (errorResponse.message.includes("The domain is not available to be claimed")) {
            this.toastService.showToast({
              variant: "error",
              title: null,
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

  async deleteDomain(orgDomainId: string): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "removeDomain" },
      content: { key: "removeDomainWarning" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    await this.orgDomainApiService.delete(this.organizationId, orgDomainId);

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("domainRemoved"),
    });
  }

  ngOnDestroy(): void {
    this.componentDestroyed$.next();
    this.componentDestroyed$.complete();
  }
}
