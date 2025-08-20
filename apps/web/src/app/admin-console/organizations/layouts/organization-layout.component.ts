// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { combineLatest, filter, map, Observable, switchMap, withLatestFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  canAccessBillingTab,
  canAccessGroupsTab,
  canAccessMembersTab,
  canAccessOrgAdmin,
  canAccessReportingTab,
  canAccessSettingsTab,
  canAccessVaultTab,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { PolicyType, ProviderStatusType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationBillingServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { getById } from "@bitwarden/common/platform/misc";
import { BannerModule, IconModule, AdminConsoleLogo } from "@bitwarden/components";
import { OrganizationWarningsModule } from "@bitwarden/web-vault/app/billing/organizations/warnings/organization-warnings.module";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";
import { NonIndividualSubscriber } from "@bitwarden/web-vault/app/billing/types";
import { TaxIdWarningComponent } from "@bitwarden/web-vault/app/billing/warnings/components";
import { TaxIdWarningType } from "@bitwarden/web-vault/app/billing/warnings/types";

import { FreeFamiliesPolicyService } from "../../../billing/services/free-families-policy.service";
import { OrgSwitcherComponent } from "../../../layouts/org-switcher/org-switcher.component";
import { WebLayoutModule } from "../../../layouts/web-layout.module";

@Component({
  selector: "app-organization-layout",
  templateUrl: "organization-layout.component.html",
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    WebLayoutModule,
    IconModule,
    OrgSwitcherComponent,
    BannerModule,
    TaxIdWarningComponent,
    TaxIdWarningComponent,
    OrganizationWarningsModule,
  ],
})
export class OrganizationLayoutComponent implements OnInit {
  protected readonly logo = AdminConsoleLogo;

  protected orgFilter = (org: Organization) => canAccessOrgAdmin(org);

  protected integrationPageEnabled$: Observable<boolean>;

  organization$: Observable<Organization>;
  canAccessExport$: Observable<boolean>;
  showPaymentAndHistory$: Observable<boolean>;
  hideNewOrgButton$: Observable<boolean>;
  organizationIsUnmanaged$: Observable<boolean>;

  protected isBreadcrumbEventLogsEnabled$: Observable<boolean>;
  protected showSponsoredFamiliesDropdown$: Observable<boolean>;
  protected canShowPoliciesTab$: Observable<boolean>;

  protected paymentDetailsPageData$: Observable<{
    route: string;
    textKey: string;
  }>;

  protected subscriber$: Observable<NonIndividualSubscriber>;
  protected getTaxIdWarning$: () => Observable<TaxIdWarningType | null>;

  constructor(
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    private platformUtilsService: PlatformUtilsService,
    private configService: ConfigService,
    private policyService: PolicyService,
    private providerService: ProviderService,
    private accountService: AccountService,
    private freeFamiliesPolicyService: FreeFamiliesPolicyService,
    private organizationBillingService: OrganizationBillingServiceAbstraction,
    private organizationWarningsService: OrganizationWarningsService,
  ) {}

  async ngOnInit() {
    this.isBreadcrumbEventLogsEnabled$ = this.configService.getFeatureFlag$(
      FeatureFlag.PM12276_BreadcrumbEventLogs,
    );
    document.body.classList.remove("layout_frontend");

    this.organization$ = this.route.params.pipe(
      map((p) => p.organizationId),
      withLatestFrom(this.accountService.activeAccount$.pipe(getUserId)),
      switchMap(([orgId, userId]) =>
        this.organizationService.organizations$(userId).pipe(getById(orgId)),
      ),
      filter((org) => org != null),
    );
    this.showSponsoredFamiliesDropdown$ =
      this.freeFamiliesPolicyService.showSponsoredFamiliesDropdown$(this.organization$);

    this.canAccessExport$ = this.organization$.pipe(map((org) => org.canAccessExport));

    this.showPaymentAndHistory$ = this.organization$.pipe(
      map(
        (org) =>
          !this.platformUtilsService.isSelfHost() &&
          org.canViewBillingHistory &&
          org.canEditPaymentMethods,
      ),
    );

    this.hideNewOrgButton$ = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.policyService.policyAppliesToUser$(PolicyType.SingleOrg, userId)),
    );

    const provider$ = this.organization$.pipe(
      switchMap((organization) => this.providerService.get$(organization.providerId)),
    );

    this.organizationIsUnmanaged$ = combineLatest([this.organization$, provider$]).pipe(
      map(
        ([organization, provider]) =>
          !organization.hasProvider ||
          !provider ||
          provider.providerStatus !== ProviderStatusType.Billable,
      ),
    );

    this.integrationPageEnabled$ = this.organization$.pipe(map((org) => org.canAccessIntegrations));

    this.canShowPoliciesTab$ = this.organization$.pipe(
      switchMap((organization) =>
        this.organizationBillingService
          .isBreadcrumbingPoliciesEnabled$(organization)
          .pipe(
            map(
              (isBreadcrumbingEnabled) => isBreadcrumbingEnabled || organization.canManagePolicies,
            ),
          ),
      ),
    );

    this.paymentDetailsPageData$ = this.configService
      .getFeatureFlag$(FeatureFlag.PM21881_ManagePaymentDetailsOutsideCheckout)
      .pipe(
        map((managePaymentDetailsOutsideCheckout) =>
          managePaymentDetailsOutsideCheckout
            ? { route: "billing/payment-details", textKey: "paymentDetails" }
            : { route: "billing/payment-method", textKey: "paymentMethod" },
        ),
      );

    this.subscriber$ = this.organization$.pipe(
      map((organization) => ({
        type: "organization",
        data: organization,
      })),
    );

    this.getTaxIdWarning$ = () =>
      this.organization$.pipe(
        switchMap((organization) =>
          this.organizationWarningsService.getTaxIdWarning$(organization),
        ),
      );
  }

  canShowVaultTab(organization: Organization): boolean {
    return canAccessVaultTab(organization);
  }

  canShowSettingsTab(organization: Organization): boolean {
    return canAccessSettingsTab(organization);
  }

  canShowMembersTab(organization: Organization): boolean {
    return canAccessMembersTab(organization);
  }

  canShowGroupsTab(organization: Organization): boolean {
    return canAccessGroupsTab(organization);
  }

  canShowReportsTab(organization: Organization): boolean {
    return canAccessReportingTab(organization);
  }

  canShowBillingTab(organization: Organization): boolean {
    return canAccessBillingTab(organization);
  }

  getReportTabLabel(organization: Organization): string {
    return organization.useEvents ? "reporting" : "reports";
  }

  refreshTaxIdWarning = () => this.organizationWarningsService.refreshTaxIdWarning();
}
