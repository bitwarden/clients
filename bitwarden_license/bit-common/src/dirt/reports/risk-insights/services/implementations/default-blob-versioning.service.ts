import { Injectable } from "@angular/core";

import { LogService } from "@bitwarden/logging";

import {
  isRiskInsightsSummaryData,
  isV2ApplicationBlobWrapper,
  validateAccessReportPayload,
  validateApplicationHealthReportDetailArray,
  validateOrganizationReportApplicationArray,
  validateRiskInsightsApplicationDataArray,
} from "../../helpers/type-guards/risk-insights-type-guards";
import { ApplicationHealthReportDetail, MemberDetails } from "../../models";
import { MemberRegistryEntryData } from "../../models/data/member-details.data";
import { RiskInsightsApplicationData } from "../../models/data/risk-insights-application.data";
import { RiskInsightsReportData } from "../../models/data/risk-insights-report.data";
import { RiskInsightsSummaryData } from "../../models/data/risk-insights-summary.data";
import {
  AccessReportPayload,
  UnsupportedReportFormatError,
} from "../abstractions/access-report-encryption.service";
import { BlobVersioningService } from "../abstractions/blob-versioning.service";

@Injectable()
export class DefaultBlobVersioningService extends BlobVersioningService {
  private readonly CURRENT_VERSION = 2;

  constructor(private logService: LogService) {
    super();
  }

  processReport(json: unknown): { data: AccessReportPayload; wasV1: boolean } {
    if (Array.isArray(json)) {
      this.logService.warning(
        `[DefaultBlobVersioningService] Report blob: unversioned (legacy) format detected — transforming to version ${this.CURRENT_VERSION}`,
      );
      const v1Data = validateApplicationHealthReportDetailArray(json);
      const data = this._transformV1ReportToPayload(v1Data);
      return { data, wasV1: true };
    }

    if (
      typeof json === "object" &&
      json !== null &&
      (json as Record<string, unknown>)["version"] === this.CURRENT_VERSION
    ) {
      this.logService.debug(
        `[DefaultBlobVersioningService] Report blob: version ${this.CURRENT_VERSION} — no transformation needed`,
      );
      const data = validateAccessReportPayload(json);
      return { data, wasV1: false };
    }

    const version =
      typeof json === "object" && json !== null
        ? (json as Record<string, unknown>)["version"]
        : undefined;
    throw new UnsupportedReportFormatError(typeof version === "number" ? version : undefined);
  }

  processApplication(json: unknown): { data: RiskInsightsApplicationData[]; wasV1: boolean } {
    if (isV2ApplicationBlobWrapper(json)) {
      this.logService.debug(
        `[DefaultBlobVersioningService] Application blob: version ${this.CURRENT_VERSION} — no transformation needed`,
      );
      const data = validateRiskInsightsApplicationDataArray(json.items);
      return { data, wasV1: false };
    }

    if (Array.isArray(json)) {
      this.logService.warning(
        `[DefaultBlobVersioningService] Application blob: unversioned (legacy) format detected — transforming reviewedDate to string, targeting version ${this.CURRENT_VERSION}`,
      );
      const v1Apps = validateOrganizationReportApplicationArray(json);
      const data: RiskInsightsApplicationData[] = v1Apps.map((app) => ({
        applicationName: app.applicationName,
        isCritical: app.isCritical,
        reviewedDate: app.reviewedDate instanceof Date ? app.reviewedDate.toISOString() : undefined,
      }));
      return { data, wasV1: true };
    }

    throw new Error(
      "Application data validation failed: expected array or versioned wrapper object.",
    );
  }

  processSummary(json: unknown): { data: RiskInsightsSummaryData; wasV1: boolean } {
    const wasV1 = typeof json !== "object" || json === null || !("version" in (json as object));

    if (!isRiskInsightsSummaryData(json)) {
      const errors = isRiskInsightsSummaryData.explain(json).join("; ");
      throw new Error(`Summary data validation failed: ${errors}`);
    }

    if (wasV1) {
      this.logService.warning(
        `[DefaultBlobVersioningService] Summary blob: unversioned (legacy) format detected — will be re-saved at version ${this.CURRENT_VERSION}`,
      );
    } else {
      this.logService.debug(
        `[DefaultBlobVersioningService] Summary blob: version ${this.CURRENT_VERSION} — no transformation needed`,
      );
    }

    return { data: json, wasV1 };
  }

  serializeReport(data: AccessReportPayload): string {
    return JSON.stringify({ version: this.CURRENT_VERSION, ...data });
  }

  serializeApplication(data: RiskInsightsApplicationData[]): string {
    return JSON.stringify({ version: this.CURRENT_VERSION, items: data });
  }

  serializeSummary(data: RiskInsightsSummaryData): string {
    return JSON.stringify({ version: this.CURRENT_VERSION, ...data });
  }

  /**
   * Transforms a V1 report payload (ApplicationHealthReportDetail[]) into a V2
   * AccessReportPayload by building a deduplicated member registry and converting
   * member/cipher arrays to Record<id, isAtRisk> maps.
   */
  private _transformV1ReportToPayload(
    v1Data: ApplicationHealthReportDetail[],
  ): AccessReportPayload {
    const memberRegistry: Record<string, MemberRegistryEntryData> = {};

    for (const app of v1Data) {
      for (const member of app.memberDetails) {
        if (!memberRegistry[member.userGuid]) {
          memberRegistry[member.userGuid] = {
            id: member.userGuid,
            userName: member.userName ?? undefined,
            email: member.email,
          };
        }
      }
    }

    const reports: RiskInsightsReportData[] = v1Data.map((app) => {
      const atRiskMemberSet = new Set(
        app.atRiskMemberDetails.map((m: MemberDetails) => m.userGuid),
      );
      const atRiskCipherSet = new Set(app.atRiskCipherIds);

      const memberRefs: Record<string, boolean> = {};
      for (const member of app.memberDetails) {
        memberRefs[member.userGuid] = atRiskMemberSet.has(member.userGuid);
      }

      const cipherRefs: Record<string, boolean> = {};
      for (const cipherId of app.cipherIds) {
        cipherRefs[cipherId] = atRiskCipherSet.has(cipherId);
      }

      return {
        applicationName: app.applicationName,
        passwordCount: app.passwordCount,
        atRiskPasswordCount: app.atRiskPasswordCount,
        memberCount: app.memberCount,
        atRiskMemberCount: app.atRiskMemberCount,
        memberRefs,
        cipherRefs,
      };
    });

    return { reports, memberRegistry };
  }
}
