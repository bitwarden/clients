// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, lastValueFrom, Observable, Subject } from "rxjs";
import { first, map, takeUntil } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationSponsorshipRedeemRequest } from "@bitwarden/common/admin-console/models/request/organization/organization-sponsorship-redeem.request";
import { PreValidateSponsorshipResponse } from "@bitwarden/common/admin-console/models/response/pre-validate-sponsorship.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { PlanSponsorshipType, PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";

import { OrganizationPlansComponent } from "../../../billing";
import { SharedModule } from "../../../shared";
import {
  DeleteOrganizationDialogResult,
  openDeleteOrganizationDialog,
} from "../settings/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "families-for-enterprise-setup.component.html",
  imports: [SharedModule, OrganizationPlansComponent],
})
export class FamiliesForEnterpriseSetupComponent implements OnInit, OnDestroy {
  loading = true;
  badToken = false;

  token!: string;
  existingFamilyOrganizations$!: Observable<Organization[]>;

  showNewOrganization = false;
  preValidateSponsorshipResponse!: PreValidateSponsorshipResponse;
  _selectedFamilyOrganizationId = "";

  private _destroy = new Subject<void>();
  protected familyPlan: PlanType;
  protected readonly familyProductTier = ProductTierType.Families;
  protected readonly planSponsorshipType = PlanSponsorshipType.FamiliesForEnterprise;

  formGroup = this.formBuilder.group({
    selectedFamilyOrganizationId: ["", Validators.required],
  });

  constructor(
    private router: Router,
    private i18nService: I18nService,
    private route: ActivatedRoute,
    private apiService: ApiService,
    private syncService: SyncService,
    private validationService: ValidationService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private dialogService: DialogService,
    private formBuilder: FormBuilder,
    private toastService: ToastService,
    private logService: LogService,
  ) {}

  async ngOnInit() {
    document.body.classList.remove("layout_frontend");
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (qParams) => {
      const error = qParams.token == null;
      if (error) {
        this.logService.warning("[Sponsorship] No token found in query params");
        this.toastService.showToast({
          variant: "error",
          title: null,
          message: this.i18nService.t("sponsoredFamiliesAcceptFailed"),
          timeout: 10000,
        });
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.router.navigate(["/"]);
        return;
      }

      this.token = qParams.token;
      this.logService.info(
        `[Sponsorship] Token present (length=${this.token.length}), starting validation`,
      );

      await this.syncService.fullSync(true);

      this.preValidateSponsorshipResponse = await this.apiService.postPreValidateSponsorshipToken(
        this.token,
      );

      this.logService.info(
        `[Sponsorship] Pre-validation result: isTokenValid=${this.preValidateSponsorshipResponse.isTokenValid}, isFreeFamilyPolicyEnabled=${this.preValidateSponsorshipResponse.isFreeFamilyPolicyEnabled}`,
      );

      if (this.preValidateSponsorshipResponse.isFreeFamilyPolicyEnabled) {
        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("errorOccured"),
          message: this.i18nService.t("offerNoLongerValid"),
        });

        await this.router.navigate(["/"]);
        return;
      } else {
        this.badToken = !this.preValidateSponsorshipResponse.isTokenValid;
      }

      this.familyPlan = PlanType.FamiliesAnnually;

      this.loading = false;
    });

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.existingFamilyOrganizations$ = this.organizationService
      .organizations$(userId)
      .pipe(
        map((orgs) =>
          orgs.filter(
            (o) =>
              o.productTierType === ProductTierType.Families &&
              o.type === OrganizationUserType.Owner,
          ),
        ),
      );

    this.existingFamilyOrganizations$.pipe(takeUntil(this._destroy)).subscribe((orgs) => {
      if (orgs.length === 0) {
        this.selectedFamilyOrganizationId = "createNew";
      }
    });
    this.formGroup.valueChanges.pipe(takeUntil(this._destroy)).subscribe((val) => {
      this.selectedFamilyOrganizationId = val.selectedFamilyOrganizationId;
    });
  }

  ngOnDestroy(): void {
    this._destroy.next();
    this._destroy.complete();
  }

  submit = async () => {
    await this.doSubmit(this._selectedFamilyOrganizationId);
  };

  get selectedFamilyOrganizationId() {
    return this._selectedFamilyOrganizationId;
  }

  set selectedFamilyOrganizationId(value: string) {
    this._selectedFamilyOrganizationId = value;
    this.showNewOrganization = value === "createNew";
  }

  private async doSubmit(organizationId: string) {
    this.logService.info(
      `[Sponsorship] Redeem started: organizationId=${organizationId}, showNewOrganization=${this.showNewOrganization}, tokenLength=${this.token?.length}`,
    );

    try {
      const request = new OrganizationSponsorshipRedeemRequest();
      request.planSponsorshipType = PlanSponsorshipType.FamiliesForEnterprise;
      request.sponsoredOrganizationId = organizationId;

      await this.apiService.postRedeemSponsorship(this.token, request);

      this.logService.info("[Sponsorship] Redeem succeeded");
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("sponsoredFamiliesOfferRedeemed"),
      });
      await this.syncService.fullSync(true);

      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/"]);
      // FIXME: Remove when updating file. Eslint update
    } catch (e) {
      if (e instanceof ErrorResponse) {
        this.logService.error(
          `[Sponsorship] Redeem failed: statusCode=${e.statusCode}, message="${e.message}", validationErrors=${JSON.stringify(e.validationErrors)}`,
        );
      } else {
        this.logService.error(`[Sponsorship] Redeem failed with unexpected error: ${e}`);
      }

      if (this.showNewOrganization) {
        this.logService.warning(
          `[Sponsorship] Opening delete dialog for newly created org: organizationId=${organizationId}`,
        );
        const dialog = openDeleteOrganizationDialog(this.dialogService, {
          data: {
            organizationId: organizationId,
            requestType: "InvalidFamiliesForEnterprise",
          },
        });

        const result = await lastValueFrom(dialog.closed);

        if (result === DeleteOrganizationDialogResult.Deleted) {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.router.navigate(["/"]);
        }
      }
      this.validationService.showError(this.i18nService.t("sponsorshipTokenHasExpired"));
    }
  }

  protected async onOrganizationCreateSuccess(value: any) {
    this.logService.info(
      `[Sponsorship] Organization created successfully: organizationId=${value?.organizationId}`,
    );
    // Use newly created organization id
    await this.doSubmit(value.organizationId);
  }
}
