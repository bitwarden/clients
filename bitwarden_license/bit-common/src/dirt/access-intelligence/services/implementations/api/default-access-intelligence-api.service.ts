import { catchError, from, map, Observable, of, throwError } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { OrganizationId } from "@bitwarden/common/types/guid";

import {
  AccessReportApi,
  AccessReportFileResponseApi,
  AccessReportMetricsApi,
  AccessReportSummaryApi,
} from "../../../models";
import { AccessIntelligenceApiService } from "../../abstractions/access-intelligence-api.service";

export class DefaultAccessIntelligenceApiService extends AccessIntelligenceApiService {
  constructor(private apiService: ApiService) {
    super();
  }

  getLatestReport$(orgId: OrganizationId): Observable<AccessReportApi> {
    const response = this.apiService.send(
      "GET",
      `/reports/organizations/${orgId.toString()}/latest`,
      null,
      true,
      true,
    );
    return from(response).pipe(map((res) => new AccessReportApi(res)));
  }

  createReport$(
    orgId: OrganizationId,
    request: AccessReportApi,
  ): Observable<AccessReportFileResponseApi> {
    const response = this.apiService.send(
      "GET",
      `/reports/organizations/${orgId.toString()}/latest`,
      request,
      true,
      true,
    );
    return from(response).pipe(map((res) => new AccessReportFileResponseApi(res)));
  }

  updateSummaryData$(
    orgId: OrganizationId,
    reportId: string,
    summaryData: string | null,
    metrics?: AccessReportMetricsApi,
  ): Observable<AccessReportApi> {
    const response = this.apiService.send(
      "PATCH",
      `/reports/organizations/${orgId.toString()}/data/summary/${reportId.toString()}`,
      { summaryData, metrics, reportId: reportId, organizationId: orgId },
      true,
      true,
    );

    return from(response).pipe(map((response) => new AccessReportApi(response)));
  }

  updateApplicationData$(
    orgId: OrganizationId,
    reportId: string,
    applicationData: string | null,
  ): Observable<AccessReportApi> {
    const response = this.apiService.send(
      "PATCH",
      `/reports/organizations/${orgId.toString()}/data/application/${reportId.toString()}`,
      { applicationData, id: reportId, organizationId: orgId },
      true,
      true,
    );

    return from(response).pipe(map((response) => new AccessReportApi(response)));
  }

  getSummaryDataByDateRange$(
    orgId: OrganizationId,
    startDate: Date,
    endDate: Date,
  ): Observable<AccessReportSummaryApi[]> {
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
      map((response: any[]) =>
        Array.isArray(response) ? response.map((r) => new AccessReportSummaryApi(r)) : [],
      ),
      catchError((error: unknown) => {
        if (error instanceof ErrorResponse && error.statusCode === 404) {
          return of([]);
        }
        return throwError(() => error);
      }),
    );
  }

  uploadReportFile$(
    orgId: OrganizationId,
    reportId: string,
    file: File,
    reportFileId: string,
  ): Observable<void> {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const response = this.apiService.send(
      "POST",
      `/reports/organizations/${orgId}/${reportId}/file/report-data?reportFileId=${reportFileId}`,
      formData,
      true,
      false,
    );

    return from(response);
  }

  downloadReportFile$(url: string): Observable<string> {
    return from(
      this.apiService
        .nativeFetch(new Request(url, { cache: "no-store" }))
        .then(async (response) => {
          if (response.status !== 200) {
            throw new Error(`Failed to download report file: ${response.status}`);
          }
          const buffer = await response.arrayBuffer();
          return new TextDecoder().decode(buffer);
        }),
    );
  }

  getReportFileData$(orgId: OrganizationId, reportId: string): Observable<string> {
    return from(
      this.apiService.send(
        "GET",
        `/reports/organizations/${orgId}/${reportId}/file/download`,
        null,
        true,
        true,
      ) as Promise<string>,
    );
  }
}
