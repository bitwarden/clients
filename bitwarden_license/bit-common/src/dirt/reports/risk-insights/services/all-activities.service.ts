import { BehaviorSubject } from "rxjs";

import { OrganizationReportSummary } from "../models/report-models";

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
    newApplications: [],
  });

  reportSummary$ = this.reportSummarySubject$.asObservable();

  setCriticalAppsReportSummary(summary: OrganizationReportSummary) {
    this.reportSummarySubject$.next({
      ...this.reportSummarySubject$.getValue(),
      totalCriticalApplicationCount: summary.totalApplicationCount,
      totalCriticalAtRiskApplicationCount: summary.totalAtRiskApplicationCount,
      totalCriticalMemberCount: summary.totalMemberCount,
      totalCriticalAtRiskMemberCount: summary.totalAtRiskMemberCount,
    });
  }

  setAllAppsReportSummary(summary: OrganizationReportSummary) {
    this.reportSummarySubject$.next({
      ...this.reportSummarySubject$.getValue(),
      totalMemberCount: summary.totalMemberCount,
      totalAtRiskMemberCount: summary.totalAtRiskMemberCount,
      totalApplicationCount: summary.totalApplicationCount,
      totalAtRiskApplicationCount: summary.totalAtRiskApplicationCount,
      newApplications: summary.newApplications,
    });
  }
}
