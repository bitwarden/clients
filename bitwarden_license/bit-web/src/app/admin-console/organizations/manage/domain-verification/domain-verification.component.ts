import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Params } from "@angular/router";
import { concatMap, Observable, Subject, take, takeUntil } from "rxjs";

import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/abstractions/organization-domain/org-domain-api.service.abstraction";
import { OrgDomainServiceAbstraction } from "@bitwarden/common/abstractions/organization-domain/org-domain.service.abstraction";
import { OrganizationDomainResponse } from "@bitwarden/common/abstractions/organization-domain/responses/organization-domain.response";
import { HttpStatusCode } from "@bitwarden/common/enums";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DialogService } from "@bitwarden/components";

import {
  DomainAddEditDialogComponent,
  DomainAddEditDialogData,
} from "./domain-add-edit-dialog/domain-add-edit-dialog.component";

@Component({
  selector: "app-org-manage-domain-verification",
  templateUrl: "domain-verification.component.html",
})
export class DomainVerificationComponent implements OnInit, OnDestroy {
  private componentDestroyed$ = new Subject<void>();

  loading = true;

  organizationId: string;
  orgDomains$: Observable<OrganizationDomainResponse[]>;

  constructor(
    private route: ActivatedRoute,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private orgDomainApiService: OrgDomainApiServiceAbstraction,
    private orgDomainService: OrgDomainServiceAbstraction,
    private dialogService: DialogService,
    private validationService: ValidationService
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
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
        takeUntil(this.componentDestroyed$)
      )
      .subscribe();
  }

  async load() {
    await this.orgDomainApiService.getAllByOrgId(this.organizationId);

    this.loading = false;
  }

  addDomain() {
    const domainAddEditDialogData: DomainAddEditDialogData = {
      organizationId: this.organizationId,
      orgDomain: null,
      existingDomainNames: this.getExistingDomainNames(),
    };

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
  }

  async verifyDomain(orgDomainId: string, domainName: string): Promise<void> {
    try {
      const orgDomain: OrganizationDomainResponse = await this.orgDomainApiService.verify(
        this.organizationId,
        orgDomainId
      );

      if (orgDomain.verifiedDate) {
        this.platformUtilsService.showToast("success", null, this.i18nService.t("domainVerified"));
      } else {
        this.platformUtilsService.showToast(
          "error",
          null,
          this.i18nService.t("domainNotVerified", domainName)
        );
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
            this.platformUtilsService.showToast(
              "error",
              null,
              this.i18nService.t("domainNotAvailable", domainName)
            );
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

    this.platformUtilsService.showToast("success", null, this.i18nService.t("domainRemoved"));
  }

  ngOnDestroy(): void {
    this.componentDestroyed$.next();
    this.componentDestroyed$.complete();
  }
}
