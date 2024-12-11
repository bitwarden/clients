// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { combineLatest, filter, map, Observable, of, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
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
import { PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { getById } from "@bitwarden/common/platform/misc";
import { BannerModule, IconModule } from "@bitwarden/components";

import { OrgSwitcherComponent } from "../../../layouts/org-switcher/org-switcher.component";
import { WebLayoutModule } from "../../../layouts/web-layout.module";
import { AdminConsoleLogo } from "../../icons/admin-console-logo";

@Component({
  selector: "app-organization-layout",
  templateUrl: "organization-layout.component.html",
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    WebLayoutModule,
    IconModule,
    OrgSwitcherComponent,
    BannerModule,
  ],
})
export class OrganizationLayoutComponent implements OnInit {
  protected readonly logo = AdminConsoleLogo;

  protected orgFilter = (org: Organization) => canAccessOrgAdmin(org);
  protected domainVerificationNavigationTextKey: string;

  protected integrationPageEnabled$: Observable<boolean>;

  organization$: Observable<Organization>;
  canAccessExport$: Observable<boolean>;
  showPaymentAndHistory$: Observable<boolean>;
  hideNewOrgButton$: Observable<boolean>;
  organizationIsUnmanaged$: Observable<boolean>;
  isAccessIntelligenceFeatureEnabled = false;
  enterpriseOrganization$: Observable<boolean>;

  constructor(
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    private platformUtilsService: PlatformUtilsService,
    private configService: ConfigService,
    private policyService: PolicyService,
    private providerService: ProviderService,
    private organizationApiService: OrganizationApiServiceAbstraction,
  ) {}

  async ngOnInit() {
    document.body.classList.remove("layout_frontend");

    this.organization$ = this.route.params.pipe(
      map((p) => p.organizationId),
      switchMap((id) => this.organizationService.organizations$.pipe(getById(id))),
      filter((org) => org != null),
    );

    this.canAccessExport$ = combineLatest([
      this.organization$,
      this.configService.getFeatureFlag$(FeatureFlag.PM11360RemoveProviderExportPermission),
    ]).pipe(map(([org, removeProviderExport]) => org.canAccessExport(removeProviderExport)));

    this.showPaymentAndHistory$ = this.organization$.pipe(
      map(
        (org) =>
          !this.platformUtilsService.isSelfHost() &&
          org.canViewBillingHistory &&
          org.canEditPaymentMethods,
      ),
    );

    this.hideNewOrgButton$ = this.policyService.policyAppliesToActiveUser$(PolicyType.SingleOrg);

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

    const excludedPlans = [
      PlanType.Free,
      PlanType.Custom,
      PlanType.TeamsStarter,
      PlanType.TeamsStarter2023,
      PlanType.FamiliesAnnually,
      PlanType.FamiliesAnnually2019,
    ];

    this.integrationPageEnabled$ = combineLatest([
      this.organization$,
      this.configService.getFeatureFlag$(FeatureFlag.PM14505AdminConsoleIntegrationPage),
    ]).pipe(
      switchMap(([org, featureFlagEnabled]) =>
        of(
          (org.productTierType === ProductTierType.Enterprise ||
            org.productTierType === ProductTierType.Teams) &&
            featureFlagEnabled,
        ).pipe(
          filter(
            (enabled) =>
              enabled &&
              org.isAdmin &&
              (org.useSso || org.useScim || org.useDirectory || org.useEvents),
          ),
          switchMap(() => this.organizationApiService.getPlanType(org.id)),
          map((planType) => !excludedPlans.includes(planType)),
        ),
      ),
    );

    this.domainVerificationNavigationTextKey = (await this.configService.getFeatureFlag(
      FeatureFlag.AccountDeprovisioning,
    ))
      ? "claimedDomains"
      : "domainVerification";
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
}
