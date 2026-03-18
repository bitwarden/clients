import { Injectable } from "@angular/core";

import { LogService } from "@bitwarden/logging";

import {
  validateAccessReportSettingsDataArray,
  validateOrganizationReportApplicationArray,
} from "../../../../../reports/risk-insights/helpers";
import { AccessReportSettingsData } from "../../../../models";
import {
  UnsupportedVersionError,
  VersioningService,
  isVersionEnvelope,
} from "../../../abstractions/versioning.service";

@Injectable()
export class ApplicationVersioningService extends VersioningService<AccessReportSettingsData[]> {
  readonly currentVersion = 1;

  constructor(private logService: LogService) {
    super();
  }

  process(json: unknown): { data: AccessReportSettingsData[]; wasLegacy: boolean } {
    if (isVersionEnvelope(json)) {
      if (json.version !== this.currentVersion) {
        throw new UnsupportedVersionError(json.version);
      }
      this.logService.debug(
        `[ApplicationVersioningService] Application blob: version ${this.currentVersion} — no transformation needed`,
      );
      const data = validateAccessReportSettingsDataArray(json.data);
      return { data, wasLegacy: false };
    }

    // Legacy: plain array (original unversioned format)
    if (Array.isArray(json)) {
      this.logService.warning(
        `[ApplicationVersioningService] Application blob: unversioned (legacy) format detected — transforming reviewedDate to string, targeting version ${this.currentVersion}`,
      );
      const legacyApps = validateOrganizationReportApplicationArray(json);
      const data: AccessReportSettingsData[] = legacyApps.map((app) => ({
        applicationName: app.applicationName,
        isCritical: app.isCritical,
        reviewedDate: app.reviewedDate instanceof Date ? app.reviewedDate.toISOString() : undefined,
      }));
      return { data, wasLegacy: true };
    }

    throw new Error(
      "Application data validation failed: expected array or versioned envelope object.",
    );
  }

  serialize(data: AccessReportSettingsData[]): string {
    return JSON.stringify({ version: this.currentVersion, data });
  }
}
