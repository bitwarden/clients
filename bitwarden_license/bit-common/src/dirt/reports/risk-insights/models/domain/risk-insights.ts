import { Observable, map, throwError } from "rxjs";

import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import Domain from "@bitwarden/common/platform/models/domain/domain-base";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { conditionalEncString } from "@bitwarden/common/vault/utils/domain-utils";

import {
  AccessReportPayload,
  DecryptedAccessReportData,
  AccessReportEncryptionService,
} from "../../services/abstractions/access-report-encryption.service";
import { MemberRegistryEntryData, RiskInsightsReportData } from "../data/risk-insights-report.data";
import { RiskInsightsData } from "../data/risk-insights.data";
import { RiskInsightsApplicationView } from "../view/risk-insights-application.view";
import { RiskInsightsReportView } from "../view/risk-insights-report.view";
import { RiskInsightsSummaryView } from "../view/risk-insights-summary.view";
import { RiskInsightsView } from "../view/risk-insights.view";

export class RiskInsights extends Domain {
  id: string = "";
  organizationId: string = "";
  reports: EncString = new EncString(""); // Reports + member registry
  applications: EncString = new EncString("");
  summary: EncString = new EncString("");
  creationDate: Date;
  contentEncryptionKey?: EncString;

  constructor(obj?: RiskInsightsData) {
    super();
    if (obj == null) {
      this.creationDate = new Date();
      return;
    }
    this.id = obj.id;
    this.organizationId = obj.organizationId;
    this.reports = conditionalEncString(obj.reports) ?? new EncString("");
    this.applications = conditionalEncString(obj.applications) ?? new EncString("");
    this.summary = conditionalEncString(obj.summary) ?? new EncString("");
    this.creationDate = new Date(obj.creationDate);
    this.contentEncryptionKey = conditionalEncString(obj.contentEncryptionKey);

    // Example usage when individual keys are encrypted instead of the entire object
    // this.summary = new RiskInsightsSummary(obj.summary);

    // if (obj.reports != null) {
    //   this.reports = obj.reports.map((r) => new RiskInsightsReport(r));
    // }
    // if (obj.applications != null) {
    //   this.applications = obj.applications.map((a) => new RiskInsightsApplication(a));
    // }
  }

  /**
   * Decrypts the domain model to a view model.
   *
   * @param encryptionService - Service to handle decryption operations.
   * @param context - The organization and user identifiers for key lookup.
   */
  decrypt(
    encryptionService: AccessReportEncryptionService,
    context: { organizationId: OrganizationId; userId: UserId },
  ): Observable<RiskInsightsView> {
    if (!this.contentEncryptionKey) {
      return throwError(() => new Error("Report encryption key not found"));
    }

    return encryptionService
      .decryptReport$(
        context,
        {
          encryptedReportData: this.reports,
          encryptedSummaryData: this.summary,
          encryptedApplicationData: this.applications,
        },
        this.contentEncryptionKey,
      )
      .pipe(
        map((decryptedData) => {
          const view = new RiskInsightsView();
          view.id = this.id as any;
          view.organizationId = this.organizationId as any;
          view.creationDate = this.creationDate;
          view.contentEncryptionKey = this.contentEncryptionKey;

          view.reports = decryptedData.reportData.reports.map(RiskInsightsReportView.fromData);
          view.memberRegistry = decryptedData.reportData.memberRegistry;

          view.applications = decryptedData.applicationData.map((app) => {
            const appView = new RiskInsightsApplicationView();
            appView.applicationName = app.applicationName;
            appView.isCritical = app.isCritical;
            appView.reviewedDate = app.reviewedDate ? new Date(app.reviewedDate) : undefined;
            return appView;
          });
          view.summary = this.convertToSummaryView(decryptedData.summaryData);

          return view;
        }),
      );
  }

  /**
   * Converts domain model to data model for persistence
   *
   * @returns Data model ready for persistence
   */
  toData(): RiskInsightsData {
    const data = new RiskInsightsData();
    data.id = this.id;
    data.organizationId = this.organizationId;
    data.reports = this.reports.encryptedString ?? "";
    data.applications = this.applications.encryptedString ?? "";
    data.summary = this.summary.encryptedString ?? "";
    data.creationDate = this.creationDate.toISOString();
    data.contentEncryptionKey = this.contentEncryptionKey?.encryptedString ?? "";
    return data;
  }

  /**
   * Creates an encrypted domain model from a decrypted view model.
   *
   * @param view - The decrypted view model to encrypt.
   * @param encryptionService - Service to handle encryption operations.
   * @param context - The organization and user identifiers for key lookup.
   */
  static fromView(
    view: RiskInsightsView,
    encryptionService: AccessReportEncryptionService,
    context: { organizationId: OrganizationId; userId: UserId },
  ): Observable<RiskInsights> {
    const reportPayload: AccessReportPayload = {
      reports: view.reports.map((r) => {
        const data = new RiskInsightsReportData();
        data.applicationName = r.applicationName;
        data.passwordCount = r.passwordCount;
        data.atRiskPasswordCount = r.atRiskPasswordCount;
        data.memberRefs = { ...r.memberRefs };
        data.cipherRefs = { ...r.cipherRefs };
        data.memberCount = r.memberCount;
        data.atRiskMemberCount = r.atRiskMemberCount;
        data.iconUri = r.iconUri;
        data.iconCipherId = r.iconCipherId;
        return data;
      }),
      memberRegistry: Object.fromEntries(
        Object.entries(view.memberRegistry).map(([id, e]) => [
          id,
          { id: e.id, userName: e.userName, email: e.email } satisfies MemberRegistryEntryData,
        ]),
      ),
    };

    const v2Input: DecryptedAccessReportData = {
      version: 2,
      reportData: reportPayload,
      summaryData: {
        totalMemberCount: view.summary.totalMemberCount,
        totalAtRiskMemberCount: view.summary.totalAtRiskMemberCount,
        totalApplicationCount: view.summary.totalApplicationCount,
        totalAtRiskApplicationCount: view.summary.totalAtRiskApplicationCount,
        totalCriticalMemberCount: view.summary.totalCriticalMemberCount,
        totalCriticalAtRiskMemberCount: view.summary.totalCriticalAtRiskMemberCount,
        totalCriticalApplicationCount: view.summary.totalCriticalApplicationCount,
        totalCriticalAtRiskApplicationCount: view.summary.totalCriticalAtRiskApplicationCount,
      },
      applicationData: view.applications.map((app) => ({
        applicationName: app.applicationName,
        isCritical: app.isCritical,
        reviewedDate: app.reviewedDate?.toISOString(),
      })),
    };

    return encryptionService.encryptReport$(context, v2Input, view.contentEncryptionKey).pipe(
      map((encryptedData) => {
        const domain = new RiskInsights();
        domain.id = view.id;
        domain.organizationId = context.organizationId;
        domain.reports = encryptedData.encryptedReportData;
        domain.applications = encryptedData.encryptedApplicationData;
        domain.summary = encryptedData.encryptedSummaryData;
        domain.creationDate = view.creationDate;
        domain.contentEncryptionKey = encryptedData.contentEncryptionKey;
        return domain;
      }),
    );
  }

  private convertToSummaryView(summaryData: any): RiskInsightsSummaryView {
    const view = new RiskInsightsSummaryView();
    view.totalMemberCount = summaryData.totalMemberCount;
    view.totalAtRiskMemberCount = summaryData.totalAtRiskMemberCount;
    view.totalApplicationCount = summaryData.totalApplicationCount;
    view.totalAtRiskApplicationCount = summaryData.totalAtRiskApplicationCount;
    view.totalCriticalMemberCount = summaryData.totalCriticalMemberCount;
    view.totalCriticalAtRiskMemberCount = summaryData.totalCriticalAtRiskMemberCount;
    view.totalCriticalApplicationCount = summaryData.totalCriticalApplicationCount;
    view.totalCriticalAtRiskApplicationCount = summaryData.totalCriticalAtRiskApplicationCount;
    return view;
  }

  // [TODO] SDK Mapping
  // toSdkRiskInsights(): SdkRiskInsights {}
  // static fromSdkRiskInsights(obj?: SdkRiskInsights): RiskInsights | undefined {}
}
