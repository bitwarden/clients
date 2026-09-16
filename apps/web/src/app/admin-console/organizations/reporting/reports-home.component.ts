import { OverlayModule } from "@angular/cdk/overlay";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute, NavigationEnd, Router, RouterModule } from "@angular/router";
import { filter, map, startWith, concatMap, firstValueFrom, switchMap } from "rxjs";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Vfo1I18nPipe } from "@bitwarden/vault";

import {
  ReportVariant,
  reports,
  ReportType,
  ReportEntry,
  ReportsSharedModule,
} from "../../../dirt/reports";
import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared/shared.module";

@Component({
  selector: "app-org-reports-home",
  templateUrl: "reports-home.component.html",
  imports: [
    SharedModule,
    OverlayModule,
    ReportsSharedModule,
    HeaderModule,
    Vfo1I18nPipe,
    RouterModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsHomeComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly organizationService = inject(OrganizationService);
  private readonly accountService = inject(AccountService);
  private readonly router = inject(Router);
  private readonly configService = inject(ConfigService);

  protected readonly homepage$ = this.router.events.pipe(
    filter((event) => event instanceof NavigationEnd),
    map((event) => this.isReportsHomepageRouteUrl((event as NavigationEnd).urlAfterRedirects)),
    startWith(this.isReportsHomepageRouteUrl(this.router.url)),
  );

  protected readonly reports$ = this.route.params.pipe(
    concatMap((params) =>
      getUserId(this.accountService.activeAccount$).pipe(
        concatMap((userId) =>
          this.organizationService
            .organizations$(userId)
            .pipe(getOrganizationById(params.organizationId)),
        ),
      ),
    ),
    switchMap((org) => this.buildReports(org?.productTierType)),
  );

  private async buildReports(productType: ProductTierType | undefined): Promise<ReportEntry[]> {
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
        ...reports[ReportType.MemberAccessReport],
        variant:
          productType == ProductTierType.Enterprise
            ? ReportVariant.Enabled
            : ReportVariant.RequiresEnterprise,
      },
    ];

    const passkeyReportEnabled = await firstValueFrom(
      this.configService.getFeatureFlag$(FeatureFlag.PasskeyLoginReport),
    );

    if (passkeyReportEnabled) {
      reportsArray.push({
        ...reports[ReportType.PasskeyLogin],
        variant: reportRequiresUpgrade,
      });
    }

    return reportsArray;
  }

  private isReportsHomepageRouteUrl(url: string): boolean {
    return url.endsWith("/reports");
  }
}
