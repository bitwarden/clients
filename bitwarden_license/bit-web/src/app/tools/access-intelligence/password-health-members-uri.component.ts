import { CommonModule } from "@angular/common";
import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  CipherHealthReportUriDetail,
  MemberCipherDetailsApiService,
  RiskInsightsReportService,
} from "@bitwarden/bit-common/tools/reports/risk-insights";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BadgeModule,
  ContainerComponent,
  TableDataSource,
  TableModule,
} from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

@Component({
  standalone: true,
  selector: "tools-password-health-members-uri",
  templateUrl: "password-health-members-uri.component.html",
  imports: [
    BadgeModule,
    CommonModule,
    ContainerComponent,
    PipesModule,
    JslibModule,
    HeaderModule,
    TableModule,
  ],
  providers: [MemberCipherDetailsApiService, RiskInsightsReportService],
})
export class PasswordHealthMembersURIComponent implements OnInit {
  dataSource = new TableDataSource<CipherHealthReportUriDetail>();

  loading = true;

  private destroyRef = inject(DestroyRef);

  constructor(
    protected organizationService: OrganizationService,
    protected activatedRoute: ActivatedRoute,
    protected auditService: AuditService,
    protected i18nService: I18nService,
    protected riskInsightsReportService: RiskInsightsReportService,
  ) {}

  ngOnInit() {
    this.activatedRoute.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map(async (params) => {
          const organizationId = params.get("organizationId");
          const report =
            await this.riskInsightsReportService.generateRawDataUriReport(organizationId);
          this.dataSource.data = report;
          this.loading = false;
        }),
      )
      .subscribe();
  }
}
