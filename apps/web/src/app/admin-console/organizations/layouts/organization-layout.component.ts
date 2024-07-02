import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { combineLatest, map, mergeMap, Observable, Subject, switchMap, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  canAccessBillingTab,
  canAccessGroupsTab,
  canAccessMembersTab,
  canAccessOrgAdmin,
  canAccessReportingTab,
  canAccessSettingsTab,
  canAccessVaultTab,
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { PolicyType, ProviderStatusType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
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
export class OrganizationLayoutComponent implements OnInit, OnDestroy {
  protected readonly logo = AdminConsoleLogo;

  protected orgFilter = (org: Organization) => canAccessOrgAdmin(org);

  organization$: Observable<Organization>;
  showPaymentAndHistory$: Observable<boolean>;
  hideNewOrgButton$: Observable<boolean>;
  organizationIsUnmanaged$: Observable<boolean>;

  private _destroy = new Subject<void>();

  protected consolidatedBillingEnabled$ = this.configService.getFeatureFlag$(
    FeatureFlag.EnableConsolidatedBilling,
  );

  constructor(
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    private platformUtilsService: PlatformUtilsService,
    private configService: ConfigService,
    private policyService: PolicyService,
    private providerService: ProviderService,
  ) {}

  async ngOnInit() {
    document.body.classList.remove("layout_frontend");

    this.organization$ = this.route.params
      .pipe(takeUntil(this._destroy))
      .pipe<string>(map((p) => p.organizationId))
      .pipe(
        mergeMap((id) => {
          return this.organizationService.organizations$
            .pipe(takeUntil(this._destroy))
            .pipe(getOrganizationById(id));
        }),
      );

    this.showPaymentAndHistory$ = this.organization$.pipe(
      map(
        (org) =>
          !this.platformUtilsService.isSelfHost() &&
          org?.canViewBillingHistory &&
          org?.canEditPaymentMethods,
      ),
    );

    this.hideNewOrgButton$ = this.policyService.policyAppliesToActiveUser$(PolicyType.SingleOrg);

    const provider$ = this.organization$.pipe(
      switchMap((organization) => this.providerService.get$(organization.providerId)),
    );

    this.organizationIsUnmanaged$ = combineLatest([
      this.consolidatedBillingEnabled$,
      this.organization$,
      provider$,
    ]).pipe(
      map(
        ([consolidatedBillingEnabled, organization, provider]) =>
          !consolidatedBillingEnabled ||
          !organization.hasProvider ||
          !provider ||
          provider.providerStatus !== ProviderStatusType.Billable,
      ),
    );
  }

  ngOnDestroy() {
    this._destroy.next();
    this._destroy.complete();
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
