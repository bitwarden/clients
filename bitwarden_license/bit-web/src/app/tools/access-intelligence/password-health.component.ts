import { CommonModule } from "@angular/common";
import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  CipherHealthReportDetail,
  MemberCipherDetailsApiService,
  RiskInsightsReportService,
} from "@bitwarden/bit-common/tools/reports/risk-insights";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  BadgeModule,
  ContainerComponent,
  TableDataSource,
  TableModule,
} from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { OrganizationBadgeModule } from "@bitwarden/web-vault/app/vault/individual-vault/organization-badge/organization-badge.module";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

@Component({
  standalone: true,
  selector: "tools-password-health",
  templateUrl: "password-health.component.html",
  imports: [
    BadgeModule,
    OrganizationBadgeModule,
    CommonModule,
    ContainerComponent,
    PipesModule,
    JslibModule,
    HeaderModule,
    TableModule,
  ],
  providers: [MemberCipherDetailsApiService, RiskInsightsReportService],
})
export class PasswordHealthComponent implements OnInit {
  reportDetails: CipherHealthReportDetail[];
  dataSource = new TableDataSource<CipherHealthReportDetail>();

  loading = true;

  private destroyRef = inject(DestroyRef);

  constructor(
    protected cipherService: CipherService,
    protected passwordStrengthService: PasswordStrengthServiceAbstraction,
    protected auditService: AuditService,
    protected i18nService: I18nService,
    protected activatedRoute: ActivatedRoute,
    protected riskInsightsReportService: RiskInsightsReportService,
  ) {}

  ngOnInit() {
    this.activatedRoute.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map(async (params) => {
          const organizationId = params.get("organizationId");
          const report = await this.riskInsightsReportService.generateRawDataReport(organizationId);
          this.dataSource.data = report;
          this.loading = false;
        }),
      )
      .subscribe();
  }
}
