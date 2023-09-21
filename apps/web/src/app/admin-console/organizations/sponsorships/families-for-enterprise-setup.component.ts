import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { lastValueFrom, Observable, Subject } from "rxjs";
import { first, map, takeUntil } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationSponsorshipRedeemRequest } from "@bitwarden/common/admin-console/models/request/organization/organization-sponsorship-redeem.request";
import { PlanSponsorshipType, PlanType } from "@bitwarden/common/billing/enums";
import { ProductType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService } from "@bitwarden/components";

import { OrganizationPlansComponent } from "../../../billing/settings/organization-plans.component";
import {
  DeleteOrganizationDialogResult,
  openDeleteOrganizationDialog,
} from "../settings/components";

@Component({
  selector: "families-for-enterprise-setup",
  templateUrl: "families-for-enterprise-setup.component.html",
})
export class FamiliesForEnterpriseSetupComponent implements OnInit, OnDestroy {
  @ViewChild(OrganizationPlansComponent, { static: false })
  set organizationPlansComponent(value: OrganizationPlansComponent) {
    if (!value) {
      return;
    }

    value.plan = PlanType.FamiliesAnnually;
    value.product = ProductType.Families;
    value.acceptingSponsorship = true;
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    value.onSuccess.subscribe(this.onOrganizationCreateSuccess.bind(this));
  }

  loading = true;
  badToken = false;
  formPromise: Promise<any>;

  token: string;
  existingFamilyOrganizations: Organization[];
  existingFamilyOrganizations$: Observable<Organization[]>;

  showNewOrganization = false;
  _organizationPlansComponent: OrganizationPlansComponent;
  _selectedFamilyOrganizationId = "";

  private _destroy = new Subject<void>();

  constructor(
    private router: Router,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private route: ActivatedRoute,
    private apiService: ApiService,
    private syncService: SyncService,
    private validationService: ValidationService,
    private organizationService: OrganizationService,
    private dialogService: DialogService
  ) {}

  async ngOnInit() {
    document.body.classList.remove("layout_frontend");
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (qParams) => {
      const error = qParams.token == null;
      if (error) {
        this.platformUtilsService.showToast(
          "error",
          null,
          this.i18nService.t("sponsoredFamiliesAcceptFailed"),
          { timeout: 10000 }
        );
        this.router.navigate(["/"]);
        return;
      }

      this.token = qParams.token;

      await this.syncService.fullSync(true);
      this.badToken = !(await this.apiService.postPreValidateSponsorshipToken(this.token));
      this.loading = false;
    });

    this.existingFamilyOrganizations$ = this.organizationService.organizations$.pipe(
      map((orgs) => orgs.filter((o) => o.planProductType === ProductType.Families))
    );

    this.existingFamilyOrganizations$.pipe(takeUntil(this._destroy)).subscribe((orgs) => {
      if (orgs.length === 0) {
        this.selectedFamilyOrganizationId = "createNew";
      }
    });
  }

  ngOnDestroy(): void {
    this._destroy.next();
    this._destroy.complete();
  }

  async submit() {
    this.formPromise = this.doSubmit(this._selectedFamilyOrganizationId);
    await this.formPromise;
    this.formPromise = null;
  }

  get selectedFamilyOrganizationId() {
    return this._selectedFamilyOrganizationId;
  }

  set selectedFamilyOrganizationId(value: string) {
    this._selectedFamilyOrganizationId = value;
    this.showNewOrganization = value === "createNew";
  }

  private async doSubmit(organizationId: string) {
    try {
      const request = new OrganizationSponsorshipRedeemRequest();
      request.planSponsorshipType = PlanSponsorshipType.FamiliesForEnterprise;
      request.sponsoredOrganizationId = organizationId;

      await this.apiService.postRedeemSponsorship(this.token, request);
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("sponsoredFamiliesOfferRedeemed")
      );
      await this.syncService.fullSync(true);

      this.router.navigate(["/"]);
    } catch (e) {
      if (this.showNewOrganization) {
        const dialog = openDeleteOrganizationDialog(this.dialogService, {
          data: {
            organizationId: organizationId,
            requestType: "InvalidFamiliesForEnterprise",
          },
        });

        const result = await lastValueFrom(dialog.closed);

        if (result === DeleteOrganizationDialogResult.Deleted) {
          this.router.navigate(["/"]);
        }
      }
      this.validationService.showError(this.i18nService.t("sponsorshipTokenHasExpired"));
    }
  }

  private async onOrganizationCreateSuccess(value: any) {
    // Use newly created organization id
    await this.doSubmit(value.organizationId);
  }
}
