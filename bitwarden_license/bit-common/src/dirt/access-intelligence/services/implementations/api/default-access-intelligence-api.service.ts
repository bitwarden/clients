import { catchError, from, map, Observable, of, throwError } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";

import {
  AccessReportApi,
  AccessReportFileApi,
  AccessReportMetricsApi,
  AccessReportSummaryApi,
} from "../../../models";
import {
  AccessIntelligenceApiService,
  AccessReportCreateRequest,
  AccessReportLegacyCreateRequest,
  AccessReportSettingsUpdateRequest,
} from "../../abstractions/access-intelligence-api.service";

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
    request: AccessReportCreateRequest,
  ): Observable<AccessReportFileApi> {
    const response = this.apiService.send(
      "POST",
      `/reports/organizations/${orgId.toString()}`,
      request,
      true,
      true,
    );
    return from(response).pipe(map((response) => new AccessReportFileApi(response)));
  }

  createLegacyReport$(
    orgId: OrganizationId,
    request: AccessReportLegacyCreateRequest,
  ): Observable<AccessReportApi> {
    const response = this.apiService.send(
      "POST",
      `/reports/organizations/${orgId.toString()}`,
      request,
      true,
      true,
    );
    return from(response).pipe(map((res) => new AccessReportApi(res)));
  }

  updateSummaryData$(
    orgId: OrganizationId,
    reportId: OrganizationReportId,
    summaryData: string,
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
    reportId: OrganizationReportId,
    applicationData: string,
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

  renewReportFileUploadLink$(
    orgId: OrganizationId,
    reportId: OrganizationReportId,
  ): Observable<AccessReportFileApi> {
    const response = this.apiService.send(
      "GET",
      `/reports/organizations/${orgId}/${reportId}/file/renew`,
      null,
      true,
      true,
    );
    return from(response).pipe(map((res) => new AccessReportFileApi(res)));
  }

  deleteReport$(orgId: OrganizationId, reportId: OrganizationReportId): Observable<void> {
    const response = this.apiService.send(
      "DELETE",
      `/reports/organizations/${orgId}/${reportId}`,
      null,
      true,
      false,
    );
    return from(response);
  }

  uploadReportFile$(
    orgId: OrganizationId,
    reportId: OrganizationReportId,
    file: File,
    reportFileId: string,
  ): Observable<void> {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const response = this.apiService.send(
      "POST",
      `/reports/organizations/${orgId}/${reportId}/file?reportFileId=${reportFileId}`,
      formData,
      true,
      false,
    );

    return from(response);
  }

  downloadReportFile$(
    orgId: OrganizationId,
    reportId: OrganizationReportId,
  ): Observable<{ blob: Blob; fileName: string }> {
    const response = this.apiService.send(
      "GET",
      `/reports/organizations/${orgId}/${reportId}/file/download`,
      null,
      true,
      true,
    );

    return from(response);
  }

  updateReportSettings$(
    orgId: OrganizationId,
    reportId: OrganizationReportId,
    request: AccessReportSettingsUpdateRequest,
  ): Observable<AccessReportApi> {
    const response = this.apiService.send(
      "PATCH",
      `/reports/organizations/${orgId}/${reportId}`,
      request,
      true,
      true,
    );

    return from(response).pipe(map((response) => new AccessReportApi(response)));
  }
}
