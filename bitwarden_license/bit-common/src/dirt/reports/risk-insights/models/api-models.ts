import { EncryptedString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { PasswordHealthReportApplicationId, RiskInsightsReport } from "./domain-models";

// -------------------- Password Health Report API Models --------------------
/**
 * Request to drop a password health report application
 * Model is expected by the API endpoint
 */
export interface PasswordHealthReportApplicationDropRequest {
  organizationId: OrganizationId;
  passwordHealthReportApplicationIds: string[];
}

/**
 * Response from the API after marking an app as critical
 */
export interface PasswordHealthReportApplicationsResponse {
  id: PasswordHealthReportApplicationId;
  organizationId: OrganizationId;
  uri: string;
}

/**
 * Request to save a password health report application
 * Model is expected by the API endpoint
 */
export interface PasswordHealthReportApplicationsRequest {
  organizationId: OrganizationId;
  url: string;
}

// -------------------- Risk Insights Report API Models --------------------
export interface SaveRiskInsightsReportRequest {
  data: RiskInsightsReport;
}

export interface SaveRiskInsightsReportResponse {
  id: string;
}

export interface GetRiskInsightsReportResponse {
  id: string;
  organizationId: OrganizationId;
  // TODO Update to use creationDate from server
  date: string;
  reportData: EncryptedString;
  contentEncryptionKey: EncryptedString;
}
