import { AccessReportMetricsApi } from "./access-report-metrics.api";

/**
 * Request body for POST /reports/organizations/{organizationId}
 *
 */
export class AccessReportCreateApi {
  contentEncryptionKey?: string;
  summaryData?: string;
  applicationData?: string;
  metrics?: AccessReportMetricsApi;
  fileSize?: number;
}
