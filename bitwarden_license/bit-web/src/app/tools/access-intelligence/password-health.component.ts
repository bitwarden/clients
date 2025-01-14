// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { RiskInsightsReportService } from "@bitwarden/bit-common/tools/reports/risk-insights";
import { CipherHealthReportDetail } from "@bitwarden/bit-common/tools/reports/risk-insights/models/password-health";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
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
})
export class PasswordHealthComponent implements OnInit {
  passwordUseMap = new Map<string, number>();
  dataSource = new TableDataSource<CipherHealthReportDetail>();

  loading = true;

  private destroyRef = inject(DestroyRef);

  constructor(
    protected riskInsightsReportService: RiskInsightsReportService,
    protected i18nService: I18nService,
    protected activatedRoute: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.activatedRoute.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map(async (params) => {
          const organizationId = params.get("organizationId");
          await this.setCiphers(organizationId);
        }),
      )
      .subscribe();
  }

  async setCiphers(organizationId: string) {
    this.dataSource.data = await firstValueFrom(
      this.riskInsightsReportService.generateRawDataReport$(organizationId),
    );
    this.loading = false;
  }
}
