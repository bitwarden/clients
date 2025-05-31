import { from, Observable, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import {
  GetRiskInsightsReportResponse,
  SaveRiskInsightsReportRequest,
  SaveRiskInsightsReportResponse,
} from "../models/password-health";

export class RiskInsightsApiService {
  constructor(private apiService: ApiService) {}

  saveRiskInsightsReport(
    orgId: OrganizationId,
    request: SaveRiskInsightsReportRequest,
  ): Observable<SaveRiskInsightsReportResponse> {
    const dbResponse = this.apiService.send(
      "PUT",
      `/reports/risk-insights-report/${orgId.toString()}`,
      request.data,
      true,
      true,
    );

    return from(dbResponse as Promise<SaveRiskInsightsReportResponse>);
  }

  getRiskInsightsReport(orgId: OrganizationId): Observable<GetRiskInsightsReportResponse | null> {
    const dbResponse = this.apiService
      .send("GET", `/reports/risk-insights-report/${orgId.toString()}`, null, true, true)
      .catch((error: any): any => {
        if (error.statusCode === 404) {
          return null; // Handle 404 by returning null or an appropriate default value
        }
        throw error; // Re-throw other errors
      });

    if (dbResponse instanceof Error) {
      return of(null);
    }
    return from(dbResponse as Promise<GetRiskInsightsReportResponse>);
  }
}
