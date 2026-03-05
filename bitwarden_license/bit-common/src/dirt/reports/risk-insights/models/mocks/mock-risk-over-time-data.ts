/**
 * Mock risk-over-time response data for UI development.
 *
 * Now that getRiskOverTime$ is wired to the real server endpoint (PM-28531),
 * this mock generates data matching the server's response shape: an array of
 * encrypted summary entries with dates. Since the actual data is encrypted,
 * these mocks use placeholder encrypted strings.
 *
 * This mock is useful for Storybook stories and component development
 * when a real server connection is not available.
 */

/**
 * Returns mock server response entries matching the summary-by-date-range endpoint.
 * Each entry has the shape of OrganizationReportSummaryDataResponse from the server.
 */
export function getMockRiskOverTimeSummaryEntries(
  timeframe: string,
  organizationId: string = "mock-org-id",
): Record<string, unknown>[] {
  const now = new Date();
  const intervals = getIntervalMs(timeframe);

  return Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getTime() - intervals * (5 - i));
    return {
      organizationId,
      encryptedData: `mock-encrypted-summary-${i}`,
      encryptionKey: `mock-encryption-key-${i}`,
      date: date.toISOString(),
    };
  });
}

function getIntervalMs(timeframe: string): number {
  const day = 86_400_000;
  switch (timeframe) {
    case "month":
      return 5 * day;
    case "3mo":
      return 15 * day;
    case "6mo":
      return 30 * day;
    case "12mo":
      return 60 * day;
    case "all":
      return 90 * day;
    default:
      return 30 * day;
  }
}
