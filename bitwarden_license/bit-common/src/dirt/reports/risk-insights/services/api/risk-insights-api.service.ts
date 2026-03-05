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
  RiskOverTimeSummaryEntryResponse,
  SaveRiskInsightsReportRequest,
  SaveRiskInsightsReportResponse,
} from "../../models/api-models.types";
import { RiskOverTimeTimeframe, timeframeToDateRange } from "../../models/risk-over-time.types";

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

  /**
   * Fetches risk-over-time summary data for the given organization and timeframe.
   *
   * Calls the PM-28531 summary-by-date-range endpoint which returns up to 6
   * evenly-spaced encrypted summary entries. Each entry must be decrypted by
   * the consuming code to extract metric counts based on the selected data view.
   *
   * @param orgId - Organization to fetch data for
   * @param timeframe - UI timeframe selection, converted to startDate/endDate internally
   * @returns Array of encrypted summary entries ordered by date, or empty array on 404
   */
  getRiskOverTime$(
    orgId: OrganizationId,
    timeframe: RiskOverTimeTimeframe,
  ): Observable<RiskOverTimeSummaryEntryResponse[]> {
    const { startDate, endDate } = timeframeToDateRange(timeframe);
    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];

    const dbResponse = this.apiService.send(
      "GET",
      `/reports/organizations/${orgId.toString()}/data/summary?startDate=${startDateStr}&endDate=${endDateStr}`,
      null,
      true,
      true,
    );
    return from(dbResponse).pipe(
      map((response: any) => {
        if (!response || !Array.isArray(response)) {
          return [];
        }
        return response.map((entry: any) => new RiskOverTimeSummaryEntryResponse(entry));
      }),
      catchError((error: unknown) => {
        if (error instanceof ErrorResponse && error.statusCode === 404) {
          return of([]);
        }
        return throwError(() => error);
      }),
    );
  }
}
