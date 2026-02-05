/**
 * Risk Insights Report storage format versions.
 *
 * V1 (Legacy): Full object encryption without compression.
 * - Entire ApplicationHealthReportDetail array encrypted as single EncString
 * - No version field in stored JSON
 * - Caused WASM panic with 300MB+ payloads
 *
 * V2C (Current): Compress-then-encrypt with member registry optimization.
 * - Plain JSON with version:2, memberRegistry, and reports array
 * - Compressed using browser-native gzip, then encrypted as single EncString
 * - Member registry deduplicates member details (50-100MB → 5-10MB)
 * - Stored with V2C: prefix for format identification
 */
export const RiskInsightsReportVersion = Object.freeze({
  /**
   * Legacy format: Full encryption, no compression.
   * Identified by: No version field in decrypted JSON.
   */
  V1: 1,

  /**
   * Current format: Compress-then-encrypt with member registry.
   * Identified by: version:2 in decompressed JSON, V2C: prefix when compressed.
   */
  V2C: 2,
} as const);

export type RiskInsightsReportVersion =
  (typeof RiskInsightsReportVersion)[keyof typeof RiskInsightsReportVersion];
