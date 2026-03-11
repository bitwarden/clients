import { Injectable } from "@angular/core";

import { LogService } from "@bitwarden/logging";

import { isRiskInsightsSummaryData } from "../../../helpers/type-guards/risk-insights-type-guards";
import { RiskInsightsSummaryData } from "../../../models/data/risk-insights-summary.data";
import {
  UnsupportedVersionError,
  VersioningService,
  isVersionEnvelope,
} from "../../abstractions/versioning.service";

@Injectable()
export class SummaryVersioningService extends VersioningService<RiskInsightsSummaryData> {
  readonly currentVersion = 1;

  constructor(private logService: LogService) {
    super();
  }

  process(json: unknown): { data: RiskInsightsSummaryData; wasLegacy: boolean } {
    if (isVersionEnvelope(json)) {
      if (json.version !== this.currentVersion) {
        throw new UnsupportedVersionError(json.version);
      }
      this.logService.debug(
        `[SummaryVersioningService] Summary blob: version ${this.currentVersion} — no transformation needed`,
      );
      if (!isRiskInsightsSummaryData(json.data)) {
        const errors = isRiskInsightsSummaryData.explain(json.data).join("; ");
        throw new Error(`Summary data validation failed: ${errors}`);
      }
      return { data: json.data, wasLegacy: false };
    }

    // Legacy: plain object without envelope (original unversioned format)
    this.logService.warning(
      `[SummaryVersioningService] Summary blob: unversioned (legacy) format detected — will be re-saved at version ${this.currentVersion}`,
    );
    if (!isRiskInsightsSummaryData(json)) {
      const errors = isRiskInsightsSummaryData.explain(json).join("; ");
      throw new Error(`Summary data validation failed: ${errors}`);
    }
    return { data: json, wasLegacy: true };
  }

  serialize(data: RiskInsightsSummaryData): string {
    return JSON.stringify({ version: this.currentVersion, data });
  }
}
