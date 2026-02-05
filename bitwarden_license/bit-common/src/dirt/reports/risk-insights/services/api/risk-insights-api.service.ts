import { from, map, Observable } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";

import { enrichError, handle404AsNull, timeoutAndEnrichError } from "../../helpers";
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
      handle404AsNull(),
      map((response) => (response ? new GetRiskInsightsReportResponse(response) : null)),
    );
  }

  downloadRiskInsightsReport$(
    orgId: OrganizationId,
  ): Observable<GetRiskInsightsReportResponse | null> {
    const dbResponse = this.apiService.send(
      "GET",
      `/reports/organizations/${orgId.toString()}/latest/download`,
      null,
      true,
      true,
    );
    return from(dbResponse).pipe(
      handle404AsNull(),
      map((response) => (response ? new GetRiskInsightsReportResponse(response) : null)),
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

    return from(dbResponse).pipe(
      timeoutAndEnrichError(
        120000,
        "Request timeout: The server did not respond within 2 minutes. The report may be too large.",
        "Failed to save risk insights report",
      ),
      map((response) => new SaveRiskInsightsReportResponse(response)),
    );
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

    return from(dbResponse).pipe(
      enrichError("Failed to get risk insights summary"),
      map((response) => new GetRiskInsightsSummaryResponse(response)),
    );
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

    return from(dbResponse as Promise<void>).pipe(
      enrichError("Failed to update risk insights summary"),
    );
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
      enrichError("Failed to get risk insights application data"),
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
      enrichError("Failed to update risk insights application data"),
      map((response) => new UpdateRiskInsightsApplicationDataResponse(response)),
    );
  }

  getOrganizationGroups$(
    organizationId: OrganizationId,
  ): Observable<{ id: string; name: string }[]> {
    const dbResponse = this.apiService.send(
      "GET",
      `/organizations/${organizationId.toString()}/groups`,
      null,
      true,
      true,
    );

    return from(dbResponse).pipe(
      enrichError("Failed to get organization groups"),
      map((response) => {
        if (response?.data && Array.isArray(response.data)) {
          return response.data.map((g: { id: string; name: string }) => ({
            id: g.id,
            name: g.name,
          }));
        }
        return [];
      }),
    );
  }
}
