import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { debounceTime, map } from "rxjs";

import {
  CipherHealthReportDetail,
  MemberCipherDetailsApiService,
  RiskInsightsReportService,
} from "@bitwarden/bit-common/tools/reports/risk-insights";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SearchModule, TableDataSource, TableModule, ToastService } from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

@Component({
  standalone: true,
  selector: "tools-password-health-members",
  templateUrl: "password-health-members.component.html",
  imports: [PipesModule, HeaderModule, SearchModule, FormsModule, SharedModule, TableModule],
  providers: [MemberCipherDetailsApiService, RiskInsightsReportService],
})
export class PasswordHealthMembersComponent implements OnInit {
  dataSource = new TableDataSource<CipherHealthReportDetail>();

  loading = true;

  selectedIds: Set<number> = new Set<number>();

  protected searchControl = new FormControl("", { nonNullable: true });

  private destroyRef = inject(DestroyRef);

  constructor(
    protected i18nService: I18nService,
    protected activatedRoute: ActivatedRoute,
    protected toastService: ToastService,
    protected riskInsightsReportService: RiskInsightsReportService,
  ) {
    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe((v) => (this.dataSource.filter = v));
  }

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

  markAppsAsCritical = async () => {
    // TODO: Send to API once implemented
    return new Promise((resolve) => {
      setTimeout(() => {
        this.selectedIds.clear();
        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t("appsMarkedAsCritical"),
        });
        resolve(true);
      }, 1000);
    });
  };

  trackByFunction(_: number, item: CipherHealthReportDetail) {
    return item.id;
  }

  onCheckboxChange(id: number, event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    if (isChecked) {
      this.selectedIds.add(id);
    } else {
      this.selectedIds.delete(id);
    }
  }
}
