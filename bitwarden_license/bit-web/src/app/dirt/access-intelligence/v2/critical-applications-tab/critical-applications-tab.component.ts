import {
  Component,
  computed,
  DestroyRef,
  inject,
  ChangeDetectionStrategy,
  input,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { Router } from "@angular/router";
import { combineLatest, debounceTime, take } from "rxjs";

import { Security } from "@bitwarden/assets/svg";
import {
  AccessIntelligenceDataService,
  DrawerStateService,
  DrawerType,
} from "@bitwarden/bit-common/dirt/access-intelligence";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  LinkModule,
  NoItemsModule,
  SearchModule,
  TableDataSource,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

import { RiskInsightsTabType } from "../../models/risk-insights.models";
import { ReportLoadingComponent } from "../../shared/report-loading.component";
import { AccessSecurityTasksService } from "../services/abstractions/access-security-tasks.service";
import {
  ApplicationsTableV2Component,
  ApplicationTableRowV2,
} from "../shared/applications-table-v2/applications-table-v2.component";

/**
 * Displays critical applications with at-risk password counts and member counts.
 * Supports unmark-as-critical and bulk password change requests.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dirt-critical-applications-tab",
  standalone: true,
  templateUrl: "./critical-applications-tab.component.html",
  imports: [
    ReportLoadingComponent,
    LinkModule,
    SearchModule,
    NoItemsModule,
    PipesModule,
    SharedModule,
    ApplicationsTableV2Component,
    TypographyModule,
  ],
})
export class CriticalApplicationsTabComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly accessIntelligenceService = inject(AccessIntelligenceDataService);
  private readonly drawerStateService = inject(DrawerStateService);
  private readonly securityTasksService = inject(AccessSecurityTasksService);
  private readonly i18nService = inject(I18nService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  readonly organizationId = input.required<OrganizationId>();

  protected readonly noItemsIcon = Security;
  protected readonly dataSource = new TableDataSource<ApplicationTableRowV2>();
  protected readonly searchControl = new FormControl("", { nonNullable: true });

  protected readonly report = toSignal(this.accessIntelligenceService.report$, {
    equal: () => false,
  });
  protected readonly loading = toSignal(this.accessIntelligenceService.loading$, {
    initialValue: false,
  });
  protected readonly ciphers = toSignal(this.accessIntelligenceService.ciphers$, {
    initialValue: [],
  });

  protected readonly drawerState = this.drawerStateService.drawerState;

  protected readonly unassignedCipherIds = toSignal(
    this.securityTasksService.unassignedCriticalCipherIds$,
    { initialValue: [] },
  );

  protected readonly enableRequestPasswordChange = computed(
    () => this.unassignedCipherIds().length > 0,
  );

  protected readonly applicationSummary = computed(() => {
    const report = this.report();
    if (!report) {
      return null;
    }
    return {
      totalAtRiskMemberCount: report.summary.totalCriticalAtRiskMemberCount,
      totalMemberCount: report.summary.totalCriticalMemberCount,
      totalAtRiskApplicationCount: report.summary.totalCriticalAtRiskApplicationCount,
      totalApplicationCount: report.summary.totalCriticalApplicationCount,
    };
  });

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe((v) => (this.dataSource.filter = v));

    combineLatest([this.accessIntelligenceService.report$, this.accessIntelligenceService.ciphers$])
      .pipe(takeUntilDestroyed())
      .subscribe(([report, ciphers]) => {
        if (!report) {
          this.dataSource.data = [];
          return;
        }

        const appMetadataMap = new Map(
          report.applications.map((app) => [app.applicationName, app]),
        );

        const tableData: ApplicationTableRowV2[] = report.reports
          .filter((reportData) => {
            const metadata = appMetadataMap.get(reportData.applicationName);
            return metadata?.isCritical ?? false;
          })
          .map((reportData) => {
            const iconCipherId = reportData.getIconCipherId();
            const iconCipher = iconCipherId
              ? ciphers.find((c) => c.id === iconCipherId)
              : undefined;

            return {
              applicationName: reportData.applicationName,
              passwordCount: reportData.passwordCount,
              atRiskPasswordCount: reportData.atRiskPasswordCount,
              memberCount: reportData.memberCount,
              atRiskMemberCount: reportData.atRiskMemberCount,
              isMarkedAsCritical: true,
              iconCipher,
            };
          });

        this.dataSource.data = tableData;
      });
  }

  protected openCriticalAtRiskMembersDrawer(): void {
    this.drawerStateService.openDrawer(
      DrawerType.CriticalAtRiskMembers,
      "criticalAppsAtRiskMembers",
    );
  }

  protected openCriticalAtRiskAppsDrawer(): void {
    this.drawerStateService.openDrawer(
      DrawerType.CriticalAtRiskApps,
      "criticalAppsAtRiskApplications",
    );
  }

  readonly showAppAtRiskMembers = (applicationName: string): void => {
    this.drawerStateService.openDrawer(DrawerType.AppAtRiskMembers, applicationName);
  };

  readonly removeCriticalApplication = (hostname: string): void => {
    this.accessIntelligenceService
      .unmarkApplicationsAsCritical$([hostname])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastService.showToast({
            message: this.i18nService.t("criticalApplicationUnmarkedSuccessfully"),
            variant: "success",
          });
        },
        error: () => {
          this.toastService.showToast({
            message: this.i18nService.t("unexpectedError"),
            variant: "error",
            title: this.i18nService.t("error"),
          });
        },
      });
  };

  protected requestPasswordChange(): void {
    const orgId = this.organizationId();
    if (!orgId) {
      this.toastService.showToast({
        message: this.i18nService.t("unexpectedError"),
        variant: "error",
        title: this.i18nService.t("error"),
      });
      return;
    }

    this.securityTasksService
      .requestPasswordChangeForCriticalApplications$(orgId, this.unassignedCipherIds())
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastService.showToast({
            message: this.i18nService.t("notifiedMembers"),
            variant: "success",
            title: this.i18nService.t("success"),
          });
        },
        error: () => {
          this.toastService.showToast({
            message: this.i18nService.t("unexpectedError"),
            variant: "error",
            title: this.i18nService.t("error"),
          });
        },
      });
  }

  readonly goToAllAppsTab = async (): Promise<void> => {
    await this.router.navigate([`organizations/${this.organizationId()}/access-intelligence`], {
      queryParams: { tabIndex: RiskInsightsTabType.AllApps },
      queryParamsHandling: "merge",
    });
  };
}
