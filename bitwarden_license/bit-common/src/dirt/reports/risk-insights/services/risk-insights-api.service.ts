import { from, Observable } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";

import {
  EncryptedDataModel,
  GetRiskInsightsReportResponse,
  SaveRiskInsightsReportRequest,
  SaveRiskInsightsReportResponse,
} from "../models/password-health";

export class RiskInsightsApiService {
  constructor(private apiService: ApiService) {}

  getRiskInsightsReport(orgId: OrganizationId): Observable<GetRiskInsightsReportResponse | null> {
    const dbResponse = this.apiService
      .send("GET", `/reports/organizations/${orgId.toString()}/latest`, null, true, true)
      .catch((error: any): any => {
        if (error.statusCode === 404) {
          return null; // Handle 404 by returning null or an appropriate default value
        }
        throw error; // Re-throw other errors
      });

    return from(dbResponse as Promise<GetRiskInsightsReportResponse>);
  }

  saveRiskInsightsReport(
    request: SaveRiskInsightsReportRequest,
    organizationId: OrganizationId,
  ): Observable<SaveRiskInsightsReportResponse> {
    const dbResponse = this.apiService.send(
      "POST",
      `/reports/organizations/${organizationId.toString()}`,
      request.data,
      true,
      true,
    );

    return from(dbResponse as Promise<SaveRiskInsightsReportResponse>);
  }

  getRiskInsightsSummary(
    orgId: string,
    minDate: Date,
    maxDate: Date,
  ): Observable<EncryptedDataModel[]> {
    const minDateStr = minDate.toISOString().split("T")[0];
    const maxDateStr = maxDate.toISOString().split("T")[0];
    const dbResponse = this.apiService.send(
      "GET",
      `/reports/organizations/${orgId.toString()}/data/summary?startDate=${minDateStr}&endDate=${maxDateStr}`,
      null,
      true,
      true,
    );

    return from(dbResponse as Promise<EncryptedDataModel[]>);
  }

  updateRiskInsightsSummary(
    summaryData: EncryptedDataModel,
    organizationId: OrganizationId,
    reportId: OrganizationReportId,
  ): Observable<void> {
    const dbResponse = this.apiService.send(
      "PATCH",
      `/reports/organizations/${organizationId.toString()}/data/summary/${reportId.toString()}`,
      summaryData,
      true,
      true,
    );

    return from(dbResponse as Promise<void>);
  }

  getOrganizationReportApplicationData(
    orgId: OrganizationId,
    reportId: OrganizationReportId,
  ): Observable<EncryptedDataModel | null> {
    const dbResponse = this.apiService.send(
      "GET",
      `/reports/organizations/${orgId.toString()}/data/application/${reportId.toString()}`,
      null,
      true,
      true,
    );

    return from(dbResponse as Promise<EncryptedDataModel | null>);
  }

  updateOrganizationReportApplicationData(
    applicationData: EncryptedDataModel,
    orgId: OrganizationId,
    reportId: OrganizationReportId,
  ): Observable<void> {
    const dbResponse = this.apiService.send(
      "PATCH",
      `/reports/organizations/${orgId.toString()}/data/application/${reportId.toString()}`,
      applicationData,
      true,
      true,
    );

    return from(dbResponse as Promise<void>);
  }
}
