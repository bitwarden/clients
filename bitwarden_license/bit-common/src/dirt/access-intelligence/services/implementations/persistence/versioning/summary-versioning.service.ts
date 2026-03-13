import { Injectable } from "@angular/core";

import { LogService } from "@bitwarden/logging";

import { isAccessReportSummaryData } from "../../../../../reports/risk-insights/helpers";
import { AccessReportSummaryData } from "../../../../models";
import {
  UnsupportedVersionError,
  VersioningService,
  isVersionEnvelope,
} from "../../../abstractions/versioning.service";

@Injectable()
export class SummaryVersioningService extends VersioningService<AccessReportSummaryData> {
  readonly currentVersion = 1;

  constructor(private logService: LogService) {
    super();
  }

  process(json: unknown): { data: AccessReportSummaryData; wasLegacy: boolean } {
    if (isVersionEnvelope(json)) {
      if (json.version !== this.currentVersion) {
        throw new UnsupportedVersionError(json.version);
      }
      this.logService.debug(
        `[SummaryVersioningService] Summary blob: version ${this.currentVersion} — no transformation needed`,
      );
      if (!isAccessReportSummaryData(json.data)) {
        const errors = isAccessReportSummaryData.explain(json.data).join("; ");
        throw new Error(`Summary data validation failed: ${errors}`);
      }
      return { data: json.data, wasLegacy: false };
    }

    // Legacy: plain object without envelope (original unversioned format)
    this.logService.warning(
      `[SummaryVersioningService] Summary blob: unversioned (legacy) format detected — will be re-saved at version ${this.currentVersion}`,
    );
    if (!isAccessReportSummaryData(json)) {
      const errors = isAccessReportSummaryData.explain(json).join("; ");
      throw new Error(`Summary data validation failed: ${errors}`);
    }
    return { data: json, wasLegacy: true };
  }

  serialize(data: AccessReportSummaryData): string {
    return JSON.stringify({ version: this.currentVersion, data });
  }
}
