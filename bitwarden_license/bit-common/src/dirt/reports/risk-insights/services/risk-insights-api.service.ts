import { catchError, from, map, Observable, of, throwError } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";

import { EncryptedDataWithKey, OrganizationReportApplication } from "../models";
import {
  GetRiskInsightsApplicationDataResponse,
  GetRiskInsightsReportResponse,
  GetRiskInsightsSummaryResponse,
  SaveRiskInsightsReportRequest,
  SaveRiskInsightsReportResponse,
} from "../models/api-models.types";

export class RiskInsightsApiService {
  constructor(private apiService: ApiService) {}

  getRiskInsightsReport$(orgId: OrganizationId): Observable<GetRiskInsightsReportResponse | null> {
    const dbResponse = this.apiService.send(
      "GET",
      `/reports/organizations/${orgId.toString()}/latest`,
      null,
      true,
      true,
    );
    return from(dbResponse).pipe(
      map((response) => new GetRiskInsightsReportResponse(response)),
      catchError((error: unknown) => {
        if (error instanceof ErrorResponse && error.statusCode === 404) {
          return of(null); // Handle 404 by returning null or an appropriate default value
        }
        return throwError(() => error); // Re-throw other errors
      }),
    );
  }

  saveRiskInsightsReport$(
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

    return from(dbResponse).pipe(map((response) => new SaveRiskInsightsReportResponse(response)));
  }

  getRiskInsightsSummary$(
    orgId: string,
    minDate: Date,
    maxDate: Date,
  ): Observable<GetRiskInsightsSummaryResponse> {
    const minDateStr = minDate.toISOString().split("T")[0];
    const maxDateStr = maxDate.toISOString().split("T")[0];
    const dbResponse = this.apiService.send(
      "GET",
      `/reports/organizations/${orgId.toString()}/data/summary?startDate=${minDateStr}&endDate=${maxDateStr}`,
      null,
      true,
      true,
    );

    return from(dbResponse).pipe(map((response) => new GetRiskInsightsSummaryResponse(response)));
  }

  updateRiskInsightsSummary$(
    summaryData: EncryptedDataWithKey,
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

  getRiskInsightsApplicationData$(
    orgId: OrganizationId,
    reportId: OrganizationReportId,
  ): Observable<GetRiskInsightsApplicationDataResponse> {
    const dbResponse = this.apiService.send(
      "GET",
      `/reports/organizations/${orgId.toString()}/data/application/${reportId.toString()}`,
      null,
      true,
      true,
    );

    return from(dbResponse).pipe(
      map((response) => new GetRiskInsightsApplicationDataResponse(response)),
    );
  }

  updateRiskInsightsApplicationData$(
    applicationData: OrganizationReportApplication,
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
