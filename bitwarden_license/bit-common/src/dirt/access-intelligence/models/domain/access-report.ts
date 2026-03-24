import { Observable, map, throwError } from "rxjs";

import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import Domain from "@bitwarden/common/platform/models/domain/domain-base";
import { OrganizationId, OrganizationReportId, UserId } from "@bitwarden/common/types/guid";
import { conditionalEncString } from "@bitwarden/common/vault/utils/domain-utils";

import {
  AccessReportPayload,
  DecryptedAccessReportData,
  AccessReportEncryptionService,
} from "../../services/abstractions/access-report-encryption.service";
import { AccessReportData } from "../data/access-report.data";
import { ApplicationHealthData } from "../data/application-health.data";
import { MemberRegistryEntryData } from "../data/member-registry-entry.data";
import { AccessReportSettingsView } from "../view/access-report-settings.view";
import { AccessReportSummaryView } from "../view/access-report-summary.view";
import { AccessReportView } from "../view/access-report.view";
import { ApplicationHealthView } from "../view/application-health.view";
import { MemberRegistryEntryView } from "../view/member-registry-entry.view";

export class AccessReport extends Domain {
  id: string = "";
  organizationId: string = "";
  reports: EncString = new EncString(""); // Reports + member registry
  applications: EncString = new EncString("");
  summary: EncString = new EncString("");
  creationDate: Date;
  contentEncryptionKey?: EncString;

  constructor(obj?: AccessReportData) {
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
  }

  /**
   * Decrypts the domain model to a view model.
   *
   * @param encryptionService - Service to handle decryption operations.
   * @param context - The organization and user identifiers for key lookup.
   * @returns Observable emitting the decrypted view and a `hadLegacyBlobs` flag that is `true`
   *   when any blob was in the V1 format. The flag is a migration signal — callers that persist
   *   reports should re-save when this is `true` to upgrade the blobs to V2 format.
   */
  decrypt(
    encryptionService: AccessReportEncryptionService,
    context: { organizationId: OrganizationId; userId: UserId },
  ): Observable<{ view: AccessReportView; hadLegacyBlobs: boolean }> {
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
          const view = new AccessReportView();
          view.id = this.id as OrganizationReportId;
          view.organizationId = this.organizationId as OrganizationId;
          view.creationDate = this.creationDate;
          view.contentEncryptionKey = this.contentEncryptionKey;

          view.reports = decryptedData.reportData.reports.map(ApplicationHealthView.fromData);
          view.memberRegistry = Object.fromEntries(
            Object.entries(decryptedData.reportData.memberRegistry).map(([id, data]) => [
              id,
              MemberRegistryEntryView.fromData(data),
            ]),
          );

          view.applications = decryptedData.applicationData.map(AccessReportSettingsView.fromData);
          view.summary = decryptedData.summaryData;

          return { view, hadLegacyBlobs: decryptedData.hadLegacyBlobs === true };
        }),
      );
  }

  /**
   * Converts domain model to data model for persistence
   *
   * @returns Data model ready for persistence
   */
  toData(): AccessReportData {
    const data = new AccessReportData();
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
    view: AccessReportView,
    encryptionService: AccessReportEncryptionService,
    context: { organizationId: OrganizationId; userId: UserId },
  ): Observable<AccessReport> {
    const reportPayload: AccessReportPayload = {
      reports: view.reports.map((r) => {
        const data = new ApplicationHealthData();
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
        Object.entries(view.memberRegistry).map(([id, e]) => {
          const data = new MemberRegistryEntryData();
          data.id = e.id;
          data.userName = e.userName;
          data.email = e.email;
          return [id, data];
        }),
      ),
    };

    const payload: DecryptedAccessReportData = {
      reportData: reportPayload,
      summaryData: AccessReportSummaryView.fromJSON({
        totalMemberCount: view.summary.totalMemberCount,
        totalAtRiskMemberCount: view.summary.totalAtRiskMemberCount,
        totalApplicationCount: view.summary.totalApplicationCount,
        totalAtRiskApplicationCount: view.summary.totalAtRiskApplicationCount,
        totalCriticalMemberCount: view.summary.totalCriticalMemberCount,
        totalCriticalAtRiskMemberCount: view.summary.totalCriticalAtRiskMemberCount,
        totalCriticalApplicationCount: view.summary.totalCriticalApplicationCount,
        totalCriticalAtRiskApplicationCount: view.summary.totalCriticalAtRiskApplicationCount,
        totalPasswordCount: view.summary.totalPasswordCount,
        totalAtRiskPasswordCount: view.summary.totalAtRiskPasswordCount,
        totalCriticalPasswordCount: view.summary.totalCriticalPasswordCount,
        totalCriticalAtRiskPasswordCount: view.summary.totalCriticalAtRiskPasswordCount,
      }),
      applicationData: view.applications.map((app) => ({
        applicationName: app.applicationName,
        isCritical: app.isCritical,
        reviewedDate: app.reviewedDate?.toISOString(),
      })),
    };

    return encryptionService.encryptReport$(context, payload, view.contentEncryptionKey).pipe(
      map((encryptedData) => {
        const domain = new AccessReport();
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

  // [TODO] SDK Mapping
  // toSdkAccessReport(): SdkAccessReport {}
  // static fromSdkAccessReport(obj?: SdkAccessReport): AccessReport | undefined {}
}
