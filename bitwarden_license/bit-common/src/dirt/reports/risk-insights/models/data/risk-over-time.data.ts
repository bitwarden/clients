import { RiskOverTimeSummaryEntryResponse } from "../api-models.types";

import { RiskOverTimeDataPointData } from "./risk-over-time-data-point.data";

/**
 * Serializable data model for risk-over-time chart data.
 *
 * The server returns encrypted OrganizationReportSummary entries via the
 * summary-by-date-range endpoint (PM-28531). Each entry must be decrypted
 * before the relevant metric pair (atRisk/total) can be extracted based
 * on the selected RiskOverTimeDataView.
 *
 * - See {@link RiskOverTimeSummaryEntryResponse} for API response model
 * - See {@link RiskOverTime} for domain model
 * - See {@link RiskOverTimeView} for view model
 */
export class RiskOverTimeData {
  dataPoints: RiskOverTimeDataPointData[] = [];

  /**
   * Constructs from the raw API response entries.
   *
   * NOTE: The entries contain encrypted data. This constructor only extracts
   * the date from each entry. The atRisk/total values must be populated
   * separately after decryption by the domain layer.
   */
  constructor(entries?: RiskOverTimeSummaryEntryResponse[]) {
    if (entries == null) {
      return;
    }

    this.dataPoints = entries.map((entry) => {
      const dp = new RiskOverTimeDataPointData();
      dp.date = entry.date.toISOString();
      dp.encryptedData = entry.encryptedData?.encryptedString ?? "";
      dp.encryptionKey = entry.encryptionKey?.encryptedString ?? "";
      return dp;
    });
  }
}
