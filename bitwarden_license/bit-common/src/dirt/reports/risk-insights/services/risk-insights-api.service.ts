import { from, Observable } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

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
      .send("GET", `/reports/organization-reports/latest/${orgId.toString()}`, null, true, true)
      .catch((error: any): any => {
        if (error.statusCode === 404) {
          return null; // Handle 404 by returning null or an appropriate default value
        }
        throw error; // Re-throw other errors
      });

    return from(dbResponse as Promise<GetRiskInsightsReportResponse>);
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
      `organization-report-summary/${orgId.toString()}?from=${minDateStr}&to=${maxDateStr}`,
      null,
      true,
      true,
    );

    return from(dbResponse as Promise<EncryptedDataModel[]>);
  }

  saveRiskInsightsSummary(data: EncryptedDataModel): Observable<void> {
    const dbResponse = this.apiService.send(
      "POST",
      "organization-report-summary",
      data,
      true,
      true,
    );

    return from(dbResponse as Promise<void>);
  }

  saveRiskInsightsReport(
    request: SaveRiskInsightsReportRequest,
  ): Observable<SaveRiskInsightsReportResponse> {
    const dbResponse = this.apiService.send(
      "POST",
      `/reports/organization-reports`,
      request.data,
      true,
      true,
    );

    return from(dbResponse as Promise<SaveRiskInsightsReportResponse>);
  }

  updateRiskInsightsSummary(data: EncryptedDataModel): Observable<void> {
    const dbResponse = this.apiService.send("PUT", "organization-report-summary", data, true, true);

    return from(dbResponse as Promise<void>);
  }
}
