import { catchError, from, map, Observable, of, throwError } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";

import {
  UpdateRiskInsightsApplicationDataRequest,
  UpdateRiskInsightsApplicationDataResponse,
  UpdateRiskInsightsSummaryDataRequest,
} from "../../models";
import {
  GetRiskInsightsApplicationDataResponse,
  GetRiskInsightsReportResponse,
  GetRiskInsightsSummaryResponse,
  SaveRiskInsightsReportRequest,
  SaveRiskInsightsReportResponse,
} from "../../models/api-models.types";

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
      // As of this change, the server doesn't return a 404 if a report is not found
      // Handle null response if server returns nothing
      map((response) => (response ? new GetRiskInsightsReportResponse(response) : null)),
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
    reportId: OrganizationReportId,
    organizationId: OrganizationId,
    request: UpdateRiskInsightsSummaryDataRequest,
  ): Observable<void> {
    const dbResponse = this.apiService.send(
      "PATCH",
      `/reports/organizations/${organizationId.toString()}/data/summary/${reportId.toString()}`,
      { ...request.data, reportId: reportId, organizationId },
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
    reportId: OrganizationReportId,
    orgId: OrganizationId,
    request: UpdateRiskInsightsApplicationDataRequest,
  ): Observable<UpdateRiskInsightsApplicationDataResponse> {
    const dbResponse = this.apiService.send(
      "PATCH",
      `/reports/organizations/${orgId.toString()}/data/application/${reportId.toString()}`,
      { ...request.data, id: reportId, organizationId: orgId },
      true,
      true,
    );

    return from(dbResponse).pipe(
      map((response) => new UpdateRiskInsightsApplicationDataResponse(response)),
    );
  }
}
