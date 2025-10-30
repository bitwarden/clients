import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BehaviorSubject } from "rxjs";

import { ApplicationHealthReportDetailEnriched } from "../../models";
import { OrganizationReportSummary } from "../../models/report-models";

import { RiskInsightsDataService } from "./risk-insights-data.service";

export class AllActivitiesService {
  /// This class is used to manage the summary of all applications
  /// and critical applications.
  /// Going forward, this class can be simplified by using the RiskInsightsDataService
  /// as it contains the application summary data.

  private reportSummarySubject$ = new BehaviorSubject<OrganizationReportSummary>({
    totalMemberCount: 0,
    totalCriticalMemberCount: 0,
    totalAtRiskMemberCount: 0,
    totalCriticalAtRiskMemberCount: 0,
    totalApplicationCount: 0,
    totalCriticalApplicationCount: 0,
    totalAtRiskApplicationCount: 0,
    totalCriticalAtRiskApplicationCount: 0,
  });
  reportSummary$ = this.reportSummarySubject$.asObservable();

  private allApplicationsDetailsSubject$: BehaviorSubject<ApplicationHealthReportDetailEnriched[]> =
    new BehaviorSubject<ApplicationHealthReportDetailEnriched[]>([]);
  allApplicationsDetails$ = this.allApplicationsDetailsSubject$.asObservable();

  private atRiskPasswordsCountSubject$ = new BehaviorSubject<number>(0);
  atRiskPasswordsCount$ = this.atRiskPasswordsCountSubject$.asObservable();

  private passwordChangeProgressMetricHasProgressBarSubject$ = new BehaviorSubject<boolean>(false);
  passwordChangeProgressMetricHasProgressBar$ =
    this.passwordChangeProgressMetricHasProgressBarSubject$.asObservable();

  private taskCreatedCountSubject$ = new BehaviorSubject<number>(0);
  taskCreatedCount$ = this.taskCreatedCountSubject$.asObservable();

  constructor(private dataService: RiskInsightsDataService) {
    // All application summary changes
    this.dataService.enrichedReportData$.pipe(takeUntilDestroyed()).subscribe((report) => {
      if (report) {
        this.setAllAppsReportSummary(report.summaryData);
        this.setAllAppsReportDetails(report.reportData);
      }
    });

    // Critical application summary changes
    this.dataService.criticalReportResults$.pipe(takeUntilDestroyed()).subscribe((report) => {
      if (report) {
        this.setCriticalAppsReportSummary(report.summaryData);
      }
    });
  }

  setCriticalAppsReportSummary(summary: OrganizationReportSummary) {
    if (!summary) {
      return;
    }
    this.reportSummarySubject$.next({
      ...this.reportSummarySubject$.getValue(),
      totalCriticalApplicationCount: summary.totalApplicationCount,
      totalCriticalAtRiskApplicationCount: summary.totalAtRiskApplicationCount,
      totalCriticalMemberCount: summary.totalMemberCount,
      totalCriticalAtRiskMemberCount: summary.totalAtRiskMemberCount,
    });
  }

  setAllAppsReportSummary(summary: OrganizationReportSummary) {
    if (!summary) {
      return;
    }

    this.reportSummarySubject$.next({
      ...this.reportSummarySubject$.getValue(),
      totalMemberCount: summary.totalMemberCount,
      totalAtRiskMemberCount: summary.totalAtRiskMemberCount,
      totalApplicationCount: summary.totalApplicationCount,
      totalAtRiskApplicationCount: summary.totalAtRiskApplicationCount,
    });
  }

  setAllAppsReportDetails(applications: ApplicationHealthReportDetailEnriched[]) {
    const totalAtRiskPasswords = applications
      .filter((app) => app.isMarkedAsCritical)
      .reduce((sum, app) => sum + app.atRiskPasswordCount, 0);
    this.atRiskPasswordsCountSubject$.next(totalAtRiskPasswords);

    this.allApplicationsDetailsSubject$.next(applications);
  }

  setPasswordChangeProgressMetricHasProgressBar(hasProgressBar: boolean) {
    this.passwordChangeProgressMetricHasProgressBarSubject$.next(hasProgressBar);
  }

  setTaskCreatedCount(count: number) {
    this.taskCreatedCountSubject$.next(count);
  }
}
