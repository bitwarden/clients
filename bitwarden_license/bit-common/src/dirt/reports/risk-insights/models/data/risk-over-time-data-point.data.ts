/**
 * Serializable data model for a single data point in risk-over-time chart data.
 *
 * Each data point represents one encrypted summary entry from the server.
 * The date comes directly from the server response. The encryptedData and
 * encryptionKey are preserved for decryption by the domain layer, which
 * extracts atRisk/total based on the selected RiskOverTimeDataView.
 *
 * - See {@link RiskOverTimeSummaryEntryResponse} for API model
 * - See {@link RiskOverTimeDataPoint} for domain model
 * - See {@link RiskOverTimeDataPointView} for view model
 */
export class RiskOverTimeDataPointData {
  date: string = "";
  encryptedData: string = "";
  encryptionKey: string = "";
  // Populated after decryption by the domain layer
  atRisk: number = 0;
  total: number = 0;
}
