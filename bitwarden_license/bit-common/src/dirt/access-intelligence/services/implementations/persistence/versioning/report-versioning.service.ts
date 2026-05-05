import { Injectable } from "@angular/core";

import { LogService } from "@bitwarden/logging";

import {
  validateAccessReportPayload,
  validateApplicationHealthReportDetailArray,
} from "../../../../../reports/risk-insights/helpers";
import {
  ApplicationHealthReportDetail,
  MemberDetails,
} from "../../../../../reports/risk-insights/models";
import { MemberRegistryEntryData, ApplicationHealthData } from "../../../../models";
import { AccessReportPayload } from "../../../abstractions/access-report-encryption.service";
import {
  UnsupportedVersionError,
  VersioningService,
  isVersionEnvelope,
} from "../../../abstractions/versioning.service";

@Injectable()
export class ReportVersioningService extends VersioningService<AccessReportPayload> {
  readonly currentVersion = 1;

  constructor(private logService: LogService) {
    super();
  }

  process(json: unknown): { data: AccessReportPayload; wasLegacy: boolean } {
    if (isVersionEnvelope(json)) {
      if (json.version !== this.currentVersion) {
        throw new UnsupportedVersionError(json.version);
      }
      this.logService.debug(
        `[ReportVersioningService] Report blob: version ${this.currentVersion} — no transformation needed`,
      );
      const data = validateAccessReportPayload(json.data);
      return { data, wasLegacy: false };
    }

    // Legacy: plain array (original unversioned format)
    if (Array.isArray(json)) {
      this.logService.warning(
        `[ReportVersioningService] Report blob: unversioned (legacy) format detected — transforming to version ${this.currentVersion}`,
      );
      const v1Data = validateApplicationHealthReportDetailArray(json);
      const data = this._transformLegacyReportToPayload(v1Data);
      return { data, wasLegacy: true };
    }

    const version =
      typeof json === "object" && json !== null
        ? (json as Record<string, unknown>)["version"]
        : undefined;
    throw new UnsupportedVersionError(typeof version === "number" ? version : undefined);
  }

  serialize(data: AccessReportPayload): string {
    return JSON.stringify({ version: this.currentVersion, data });
  }

  /**
   * Transforms a legacy report payload (ApplicationHealthReportDetail[]) into an
   * AccessReportPayload by building a deduplicated member registry and converting
   * member/cipher arrays to Record<id, isAtRisk> maps.
   */
  private _transformLegacyReportToPayload(
    legacyData: ApplicationHealthReportDetail[],
  ): AccessReportPayload {
    const memberRegistry: Record<string, MemberRegistryEntryData> = {};

    for (const app of legacyData) {
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

    const reports: ApplicationHealthData[] = legacyData.map((app) => {
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
