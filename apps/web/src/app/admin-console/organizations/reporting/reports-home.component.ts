import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, NavigationEnd, Router } from "@angular/router";
import { filter, map, Observable, startWith, concatMap, firstValueFrom } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { ReportVariant, reports, ReportType, ReportEntry } from "../../../tools/reports";

@Component({
  selector: "app-org-reports-home",
  templateUrl: "reports-home.component.html",
})
export class ReportsHomeComponent implements OnInit {
  reports$: Observable<ReportEntry[]>;
  homepage$: Observable<boolean>;

  private isMemberAccessReportEnabled: boolean;

  constructor(
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    private router: Router,
    private configService: ConfigService,
  ) {}

  async ngOnInit() {
    // TODO: Remove on "MemberAccessReport" feature flag cleanup
    this.isMemberAccessReportEnabled = await firstValueFrom(
      this.configService.getFeatureFlag$(FeatureFlag.MemberAccessReport),
    );

    this.homepage$ = this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => this.isReportsHomepageRouteUrl((event as NavigationEnd).urlAfterRedirects)),
      startWith(this.isReportsHomepageRouteUrl(this.router.url)),
    );

    this.reports$ = this.route.params.pipe(
      concatMap((params) => this.organizationService.get$(params.organizationId)),
      map((org) => this.buildReports(org.productTierType)),
    );
  }

  private buildReports(productType: ProductTierType): ReportEntry[] {
    const reportRequiresUpgrade =
      productType == ProductTierType.Free ? ReportVariant.RequiresUpgrade : ReportVariant.Enabled;

    const reportsArray = [
      {
        ...reports[ReportType.ExposedPasswords],
        variant: reportRequiresUpgrade,
      },
      {
        ...reports[ReportType.ReusedPasswords],
        variant: reportRequiresUpgrade,
      },
      {
        ...reports[ReportType.WeakPasswords],
        variant: reportRequiresUpgrade,
      },
      {
        ...reports[ReportType.UnsecuredWebsites],
        variant: reportRequiresUpgrade,
      },
      {
        ...reports[ReportType.Inactive2fa],
        variant: reportRequiresUpgrade,
      },
      {
        ...reports[ReportType.PasswordsReport],
        variant: reportRequiresUpgrade,
      },
    ];

    if (this.isMemberAccessReportEnabled) {
      reportsArray.push({
        ...reports[ReportType.MemberAccessReport],
        variant:
          productType == ProductTierType.Enterprise
            ? ReportVariant.Enabled
            : ReportVariant.RequiresEnterprise,
      });
    }

    return reportsArray;
  }

  private isReportsHomepageRouteUrl(url: string): boolean {
    return url.endsWith("/reports");
  }
}
