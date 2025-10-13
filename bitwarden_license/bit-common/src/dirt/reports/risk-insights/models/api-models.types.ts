import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { createNewSummaryData } from "../helpers";

import { OrganizationReportSummary, PasswordHealthReportApplicationId } from "./report-models";

// -------------------- Password Health Report Models --------------------
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
/*
 * Request to save a password health report application
 * Model is expected by the API endpoint
 */
export interface PasswordHealthReportApplicationsRequest {
  organizationId: OrganizationId;
  url: string;
}

// -------------------- Risk Insights Report Models --------------------
export interface SaveRiskInsightsReportRequest {
  data: {
    organizationId: OrganizationId;
    creationDate: string;
    reportData: string;
    summaryData: string;
    applicationData: string;
    contentEncryptionKey: string;
  };
}

export class SaveRiskInsightsReportResponse extends BaseResponse {
  id: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("organizationId");
  }
}
export function isSaveRiskInsightsReportResponse(obj: any): obj is SaveRiskInsightsReportResponse {
  return obj && typeof obj.id === "string" && obj.id !== "";
}

export class GetRiskInsightsReportResponse extends BaseResponse {
  id: string;
  organizationId: OrganizationId;
  creationDate: Date;
  reportData: EncString;
  summaryData: EncString;
  applicationData: EncString;
  contentEncryptionKey: EncString;

  constructor(response: any) {
    super(response);

    this.id = this.getResponseProperty("organizationId");
    this.organizationId = this.getResponseProperty("organizationId");
    this.creationDate = new Date(this.getResponseProperty("creationDate"));
    this.reportData = new EncString(this.getResponseProperty("reportData"));
    this.summaryData = new EncString(this.getResponseProperty("summaryData"));
    this.applicationData = new EncString(this.getResponseProperty("applicationData"));
    this.contentEncryptionKey = new EncString(this.getResponseProperty("contentEncryptionKey"));
  }
}

export class GetRiskInsightsSummaryResponse extends BaseResponse {
  id: string;
  organizationId: OrganizationId;
  encryptedSummary: EncString; // Decrypted as OrganizationReportSummary
  contentEncryptionKey: EncString;

  constructor(response: any) {
    super(response);
    // TODO Handle taking array of summary data and converting to array
    this.id = this.getResponseProperty("id");
    this.organizationId = this.getResponseProperty("organizationId");
    this.encryptedSummary = this.getResponseProperty("encryptedData");
    this.contentEncryptionKey = this.getResponseProperty("contentEncryptionKey");
  }

  // TODO
  getSummary(): OrganizationReportSummary {
    return createNewSummaryData();
  }
}
export class GetRiskInsightsApplicationDataResponse extends BaseResponse {
  reportId: string;
  organizationId: OrganizationId;
  encryptedData: EncString;
  contentEncryptionKey: EncString;

  constructor(response: any) {
    super(response);
    this.reportId = this.getResponseProperty("reportId");
    this.organizationId = this.getResponseProperty("organizationId");
    this.encryptedData = this.getResponseProperty("encryptedData");
    this.contentEncryptionKey = this.getResponseProperty("contentEncryptionKey");
  }
}
