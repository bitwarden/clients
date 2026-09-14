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
      const { data, errors } = validateAccessReportSettingsDataArray(json.data);
      if (errors.length > 0) {
        this.logService.warning(
          `[ApplicationVersioningService] Dropped ${errors.length} invalid application setting(s):\n${errors.join("\n")}`,
        );
      }
      return { data, wasLegacy: false };
    }

    // Legacy: plain array (original unversioned format)
    if (Array.isArray(json)) {
      this.logService.warning(
        `[ApplicationVersioningService] Application blob: unversioned (legacy) format detected — transforming reviewedDate to string, targeting version ${this.currentVersion}`,
      );
      const { data: legacyApps, errors } = validateOrganizationReportApplicationArray(json);
      if (errors.length > 0) {
        this.logService.warning(
          `[ApplicationVersioningService] Dropped ${errors.length} invalid application element(s) during legacy transform:\n${errors.join("\n")}`,
        );
      }
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
