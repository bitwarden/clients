import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { combineLatest, filter, map, Observable, switchMap, withLatestFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AdminConsoleLogo } from "@bitwarden/assets/svg";
import {
  canAccessAccessIntelligence,
  canAccessBillingTab,
  canAccessGroupsTab,
  canAccessMembersTab,
  canAccessOrgAdmin,
  canAccessReportingTab,
  canAccessSettingsTab,
  canAccessVaultTab,
  OrganizationService,
  singleOrganizationPolicyApplies$,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { ProviderStatusType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { getById } from "@bitwarden/common/platform/misc";
import { BannerModule, SvgModule } from "@bitwarden/components";
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    WebLayoutModule,
    SvgModule,
    OrgSwitcherComponent,
    BannerModule,
    TaxIdWarningComponent,
  ],
})
export class OrganizationLayoutComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly organizationService = inject(OrganizationService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly policyService = inject(PolicyService);
  private readonly providerService = inject(ProviderService);
  private readonly accountService = inject(AccountService);
  private readonly freeFamiliesPolicyService = inject(FreeFamiliesPolicyService);
  private readonly organizationWarningsService = inject(OrganizationWarningsService);

  protected readonly logo = AdminConsoleLogo;

  protected readonly orgFilter = (org: Organization) => canAccessOrgAdmin(org);

  private readonly userId$ = this.accountService.activeAccount$.pipe(getUserId);

  readonly organization$: Observable<Organization> = this.route.params.pipe(
    map((p) => p.organizationId),
    withLatestFrom(this.userId$),
    switchMap(([orgId, userId]) =>
      this.organizationService.organizations$(userId).pipe(getById(orgId)),
    ),
    filter((org): org is Organization => org != null),
  );

  readonly canAccessExport$: Observable<boolean> = this.organization$.pipe(
    map((org) => org.canAccessExport),
  );

  readonly showPaymentAndHistory$: Observable<boolean> = this.organization$.pipe(
    map(
      (org) =>
        !this.platformUtilsService.isSelfHost() &&
        org.canViewBillingHistory &&
        org.canEditPaymentMethods,
    ),
  );

  readonly hideNewOrgButton$: Observable<boolean> = this.userId$.pipe(
    switchMap((userId) => singleOrganizationPolicyApplies$(userId, this.policyService)),
  );

  private readonly provider$: Observable<Provider | undefined> = combineLatest([
    this.organization$,
    this.userId$,
  ]).pipe(
    switchMap(([organization, userId]) =>
      this.providerService.get$(organization.providerId, userId),
    ),
  );

  readonly organizationIsUnmanaged$: Observable<boolean> = combineLatest([
    this.organization$,
    this.provider$,
  ]).pipe(
    map(
      ([organization, provider]) =>
        !organization.hasProvider ||
        !provider ||
        provider.providerStatus !== ProviderStatusType.Billable,
    ),
  );

  protected readonly integrationPageEnabled$: Observable<boolean> = this.organization$.pipe(
    map((org) => org.canAccessIntegrations),
  );

  protected readonly showSponsoredFamiliesDropdown$: Observable<boolean> =
    this.freeFamiliesPolicyService.showSponsoredFamiliesDropdown$(this.organization$);

  protected readonly subscriber$: Observable<NonIndividualSubscriber> = this.organization$.pipe(
    map((organization) => ({ type: "organization" as const, data: organization })),
  );

  protected readonly getTaxIdWarning$: () => Observable<TaxIdWarningType | null> = () =>
    this.organization$.pipe(
      switchMap((organization) => this.organizationWarningsService.getTaxIdWarning$(organization)),
    );

  constructor() {
    document.body.classList.remove("layout_frontend");
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

  canShowAccessIntelligenceTab(organization: Organization): boolean {
    return canAccessAccessIntelligence(organization);
  }

  getReportTabLabel(organization: Organization): string {
    return organization.useEvents ? "reporting" : "reports";
  }

  refreshTaxIdWarning() {
    this.organizationWarningsService.refreshTaxIdWarning();
  }
}
