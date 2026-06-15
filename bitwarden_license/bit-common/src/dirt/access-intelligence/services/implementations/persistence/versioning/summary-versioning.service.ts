import { Injectable } from "@angular/core";

import { LogService } from "@bitwarden/logging";

import { isAccessReportSummaryView } from "../../../../../reports/risk-insights/helpers";
import { AccessReportSummaryView } from "../../../../models";
import {
  UnsupportedVersionError,
  VersioningService,
  isVersionEnvelope,
} from "../../../abstractions/versioning.service";

@Injectable()
export class SummaryVersioningService extends VersioningService<AccessReportSummaryView> {
  readonly currentVersion = 1;

  constructor(private logService: LogService) {
    super();
  }

  process(json: unknown): { data: AccessReportSummaryView; wasLegacy: boolean } {
    if (isVersionEnvelope(json)) {
      if (json.version !== this.currentVersion) {
        throw new UnsupportedVersionError(json.version);
      }
      this.logService.debug(
        `[SummaryVersioningService] Summary blob: version ${this.currentVersion} — no transformation needed`,
      );
      if (!isAccessReportSummaryView(json.data)) {
        const errors = isAccessReportSummaryView.explain(json.data).join("; ");
        throw new Error(`Summary data validation failed: ${errors}`);
      }
      return { data: AccessReportSummaryView.fromJSON(json.data), wasLegacy: false };
    }

    // Legacy: plain object without envelope (original unversioned format)
    this.logService.warning(
      `[SummaryVersioningService] Summary blob: unversioned (legacy) format detected — transforming to version ${this.currentVersion}`,
    );
    if (!isAccessReportSummaryView(json)) {
      const errors = isAccessReportSummaryView.explain(json).join("; ");
      throw new Error(`Summary data validation failed: ${errors}`);
    }
    return { data: AccessReportSummaryView.fromJSON(json), wasLegacy: true };
  }

  serialize(view: AccessReportSummaryView): string {
    // Exclude `date` — it comes from the API envelope, not the blob payload
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { date: _date, ...countFields } = { ...view };
    return JSON.stringify({ version: this.currentVersion, data: countFields });
  }
}
