import { catchError, from, map, Observable, of, throwError } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";

import {
  AccessReportApi,
  AccessReportFileApi,
<<<<<<< dirt/file-persistence/pm-31942
  AccessReportSummaryApi,
  AccessReportCreateApi,
} from "../../../models";
import { AccessIntelligenceApiService } from "../../abstractions/access-intelligence-api.service";
=======
  AccessReportMetricsApi,
  AccessReportSummaryApi,
} from "../../../models";
import {
  AccessIntelligenceApiService,
  AccessReportCreateRequest,
  AccessReportLegacyCreateRequest,
  AccessReportSettingsUpdateRequest,
} from "../../abstractions/access-intelligence-api.service";
>>>>>>> main

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
<<<<<<< dirt/file-persistence/pm-31942
    request: AccessReportCreateApi,
=======
    request: AccessReportCreateRequest,
>>>>>>> main
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

<<<<<<< dirt/file-persistence/pm-31942
=======
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

>>>>>>> main
  updateSummaryData$(
    orgId: OrganizationId,
    reportId: OrganizationReportId,
    summaryData: string,
<<<<<<< dirt/file-persistence/pm-31942
    metrics?: Record<string, number>,
=======
    metrics?: AccessReportMetricsApi,
>>>>>>> main
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
<<<<<<< dirt/file-persistence/pm-31942
      `/reports/organizations/${orgId}/${reportId}/file/report-data?reportFileId=${reportFileId}`,
=======
      `/reports/organizations/${orgId}/${reportId}/file?reportFileId=${reportFileId}`,
>>>>>>> main
      formData,
      true,
      false,
    );

    return from(response);
  }

<<<<<<< dirt/file-persistence/pm-31942
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
=======
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
>>>>>>> main
  }
}
