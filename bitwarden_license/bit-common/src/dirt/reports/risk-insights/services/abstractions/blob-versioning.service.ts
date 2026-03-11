import { RiskInsightsApplicationData } from "../../models/data/risk-insights-application.data";
import { RiskInsightsSummaryData } from "../../models/data/risk-insights-summary.data";

import { AccessReportPayload } from "./access-report-encryption.service";

/**
 * Handles format versioning for all three encrypted blobs in an AccessReport.
 *
 * Responsibilities:
 * - Detect V1 vs V2 format for each blob type
 * - Transform V1 blobs inline to V2 data structures
 * - Serialize V2 data structures to JSON strings for encryption
 *
 * This service has no knowledge of encryption — it operates entirely on
 * parsed JSON (unknown → typed data) and serialized strings.
 */
export abstract class BlobVersioningService {
  /**
   * Parses and validates a decrypted report blob, transforming V1 to V2 if needed.
   *
   * V1 format: `ApplicationHealthReportDetail[]` (plain array, no version field).
   * V2 format: `{ version: 2, reports: [...], memberRegistry: {...} }`.
   *
   * @param json - The result of `JSON.parse()` on the decrypted blob string.
   * @returns The V2 report payload and whether the input was V1 format.
   * @throws `UnsupportedReportFormatError` if the version is unknown.
   * @throws `Error` if the data fails validation.
   */
  abstract processReport(json: unknown): { data: AccessReportPayload; wasV1: boolean };

  /**
   * Parses and validates a decrypted application blob, transforming V1 to V2 if needed.
   *
   * V1 format: `OrganizationReportApplication[]` (plain array, `reviewedDate: Date|null`).
   * V2 format: `{ version: 2, items: RiskInsightsApplicationData[] }` (`reviewedDate: string|undefined`).
   *
   * @param json - The result of `JSON.parse()` on the decrypted blob string.
   * @returns The V2 application array and whether the input was V1 format.
   * @throws `Error` if the data fails validation.
   */
  abstract processApplication(json: unknown): {
    data: RiskInsightsApplicationData[];
    wasV1: boolean;
  };

  /**
   * Parses and validates a decrypted summary blob.
   *
   * V1 format: plain `OrganizationReportSummary` object (no `version` field).
   * V2 format: same fields with an additional `version: 2` field.
   * Both formats have identical field shapes; V1 is detected by the absence of `version`.
   *
   * @param json - The result of `JSON.parse()` on the decrypted blob string.
   * @returns The summary data and whether the input was V1 format.
   * @throws `Error` if the data fails validation.
   */
  abstract processSummary(json: unknown): { data: RiskInsightsSummaryData; wasV1: boolean };

  /**
   * Serializes a V2 report payload to a JSON string for encryption.
   * Wraps the payload with `version: 2`.
   */
  abstract serializeReport(data: AccessReportPayload): string;

  /**
   * Serializes a V2 application array to a JSON string for encryption.
   * Wraps the array in `{ version: 2, items: [...] }`.
   */
  abstract serializeApplication(data: RiskInsightsApplicationData[]): string;

  /**
   * Serializes V2 summary data to a JSON string for encryption.
   * Embeds `version: 2` directly in the object alongside the existing fields.
   */
  abstract serializeSummary(data: RiskInsightsSummaryData): string;
}
