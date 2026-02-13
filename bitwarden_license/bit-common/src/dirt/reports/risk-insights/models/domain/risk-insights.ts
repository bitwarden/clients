import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import Domain from "@bitwarden/common/platform/models/domain/domain-base";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { conditionalEncString } from "@bitwarden/common/vault/utils/domain-utils";

import { RiskInsightsEncryptionService } from "../../services/domain/risk-insights-encryption.service";
import { RiskInsightsData } from "../data/risk-insights.data";
import { RiskInsightsApplicationView } from "../view/risk-insights-application.view";
import { RiskInsightsReportView } from "../view/risk-insights-report.view";
import { RiskInsightsSummaryView } from "../view/risk-insights-summary.view";
import { MemberRegistry, RiskInsightsView } from "../view/risk-insights.view";

export class RiskInsights extends Domain {
  id: string = "";
  organizationId: string = "";
  reports: EncString = new EncString("");
  applications: EncString = new EncString("");
  summary: EncString = new EncString("");
  memberRegistry: EncString = new EncString("");
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
    this.memberRegistry = conditionalEncString(obj.memberRegistry) ?? new EncString("");
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
   * Decrypts the domain model to a view model
   *
   * Follows the Cipher pattern. Decrypts all encrypted fields and constructs
   * a fully-hydrated RiskInsightsView with reports, applications, and summary.
   *
   * @param encryptionService - Service to handle decryption operations
   * @param context - Encryption context (organizationId and userId)
   * @returns Promise resolving to decrypted view model
   */
  async decrypt(
    encryptionService: RiskInsightsEncryptionService,
    context: { organizationId: OrganizationId; userId: UserId },
  ): Promise<RiskInsightsView> {
    if (!this.contentEncryptionKey) {
      throw new Error("Report encryption key not found");
    }

    const decryptedData = await encryptionService.decryptRiskInsightsReport(
      context,
      {
        encryptedReportData: this.reports,
        encryptedSummaryData: this.summary,
        encryptedApplicationData: this.applications,
      },
      this.contentEncryptionKey,
    );

    const view = new RiskInsightsView();
    view.id = this.id as any;
    view.organizationId = this.organizationId as any;
    view.creationDate = this.creationDate;
    view.contentEncryptionKey = this.contentEncryptionKey;

    // Convert decrypted data to view models
    view.reports = this.convertToReportViews(decryptedData.reportData);
    view.applications = decryptedData.applicationData.map((app) => {
      const appView = new RiskInsightsApplicationView();
      appView.applicationName = app.applicationName;
      appView.isCritical = app.isCritical;
      appView.reviewedDate = app.reviewedDate ?? undefined;
      return appView;
    });
    view.summary = this.convertToSummaryView(decryptedData.summaryData);

    // Build member registry from reports
    view.memberRegistry = this.buildMemberRegistry(decryptedData.reportData);

    return view;
  }

  /**
   * Converts domain model to data model for persistence
   *
   * Follows the Cipher pattern. Extracts encrypted strings as plain strings
   * for serialization to storage/API.
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
    data.memberRegistry = this.memberRegistry.encryptedString ?? "";
    data.creationDate = this.creationDate.toISOString();
    data.contentEncryptionKey = this.contentEncryptionKey?.encryptedString ?? "";
    return data;
  }

  /**
   * Creates an encrypted domain model from a decrypted view model
   *
   * Follows the Cipher pattern. Encrypts all sensitive fields and returns
   * a domain model ready for persistence.
   *
   * @param view - Decrypted view model to encrypt
   * @param encryptionService - Service to handle encryption operations
   * @param context - Encryption context (organizationId and userId)
   * @returns Promise resolving to encrypted domain model
   */
  static async fromView(
    view: RiskInsightsView,
    encryptionService: RiskInsightsEncryptionService,
    context: { organizationId: OrganizationId; userId: UserId },
  ): Promise<RiskInsights> {
    // Convert view models to plain objects for encryption
    const reportData = view.reports.map((report) => {
      const cipherIds = Object.keys(report.cipherRefs);
      const atRiskCipherIds = Object.entries(report.cipherRefs)
        .filter(([_, isAtRisk]) => isAtRisk)
        .map(([id]) => id);

      const memberDetails = Object.keys(report.memberRefs).map((memberId) => {
        const member = view.memberRegistry[memberId];
        return {
          userGuid: memberId,
          userName: member?.userName ?? "",
          email: member?.email ?? "",
          cipherId: "", // Not needed for encryption payload
        };
      });

      const atRiskMemberDetails = Object.entries(report.memberRefs)
        .filter(([_, isAtRisk]) => isAtRisk)
        .map(([memberId]) => {
          const member = view.memberRegistry[memberId];
          return {
            userGuid: memberId,
            userName: member?.userName ?? "",
            email: member?.email ?? "",
            cipherId: "", // Not needed for encryption payload
          };
        });

      return {
        applicationName: report.applicationName,
        passwordCount: cipherIds.length,
        atRiskPasswordCount: atRiskCipherIds.length,
        cipherIds: cipherIds as any,
        atRiskCipherIds: atRiskCipherIds as any,
        memberCount: memberDetails.length,
        atRiskMemberCount: atRiskMemberDetails.length,
        memberDetails,
        atRiskMemberDetails,
      };
    });

    const applicationData = view.applications.map((app) => ({
      applicationName: app.applicationName,
      isCritical: app.isCritical,
      reviewedDate: app.reviewedDate ?? null,
    }));

    const summaryData = {
      totalMemberCount: view.summary.totalMemberCount,
      totalAtRiskMemberCount: view.summary.totalAtRiskMemberCount,
      totalApplicationCount: view.summary.totalApplicationCount,
      totalAtRiskApplicationCount: view.summary.totalAtRiskApplicationCount,
      totalCriticalMemberCount: view.summary.totalCriticalMemberCount,
      totalCriticalAtRiskMemberCount: view.summary.totalCriticalAtRiskMemberCount,
      totalCriticalApplicationCount: view.summary.totalCriticalApplicationCount,
      totalCriticalAtRiskApplicationCount: view.summary.totalCriticalAtRiskApplicationCount,
    };

    const encryptedData = await encryptionService.encryptRiskInsightsReport(
      context,
      { reportData, summaryData, applicationData },
      view.contentEncryptionKey,
    );

    const domain = new RiskInsights();
    domain.id = view.id;
    domain.organizationId = context.organizationId;
    domain.reports = encryptedData.encryptedReportData;
    domain.applications = encryptedData.encryptedApplicationData;
    domain.summary = encryptedData.encryptedSummaryData;
    domain.memberRegistry = new EncString(""); // TODO: Encrypt member registry
    domain.creationDate = view.creationDate;
    domain.contentEncryptionKey = encryptedData.contentEncryptionKey;

    return domain;
  }

  private convertToReportViews(reportData: any[]): RiskInsightsReportView[] {
    return reportData.map((report) => {
      const view = new RiskInsightsReportView();
      view.applicationName = report.applicationName;
      view.passwordCount = report.cipherIds.length;
      view.atRiskPasswordCount = report.atRiskCipherIds.length;
      view.memberCount = report.memberDetails.length;
      view.atRiskMemberCount = report.atRiskMemberDetails.length;

      // Build cipherRefs Record
      report.cipherIds.forEach((cipherId: string) => {
        const isAtRisk = report.atRiskCipherIds.includes(cipherId);
        view.cipherRefs[cipherId] = isAtRisk;
      });

      // Build memberRefs Record
      const atRiskMemberIds = new Set(report.atRiskMemberDetails.map((m: any) => m.userGuid));
      report.memberDetails.forEach((member: any) => {
        view.memberRefs[member.userGuid] = atRiskMemberIds.has(member.userGuid);
      });

      return view;
    });
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

  private buildMemberRegistry(reportData: any[]): MemberRegistry {
    const registry: MemberRegistry = {};

    reportData.forEach((report) => {
      report.memberDetails.forEach((member: any) => {
        if (!registry[member.userGuid]) {
          registry[member.userGuid] = {
            id: member.userGuid,
            userName: member.userName,
            email: member.email,
          };
        }
      });
    });

    return registry;
  }

  // [TODO] SDK Mapping
  // toSdkRiskInsights(): SdkRiskInsights {}
  // static fromSdkRiskInsights(obj?: SdkRiskInsights): RiskInsights | undefined {}
}
