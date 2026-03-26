import { Observable } from "rxjs";

import { OrganizationId } from "@bitwarden/sdk-internal";

import { AccessReportApi, AccessReportFileResponseApi, AccessReportSummaryApi } from "../../models";

export abstract class AccessIntelligenceApiService {
  /** GET /reports/organizations/{orgId}/latest */
  abstract getLatestReport$(orgId: OrganizationId): Observable<AccessReportApi>;

  /**
   * POST /reports/organizations/{orgId}
   * V2: returns upload URL + report metadata. V1: returns report metadata only.
   */
  abstract createReport$(
    orgId: OrganizationId,
    request: AccessReportApi,
  ): Observable<AccessReportFileResponseApi | AccessReportApi>;

  /**
   * POST /reports/organizations/{orgId}/{reportId}/file/report-data
   * Self-hosted only. Uploads report data file via multipart form data.
   */
  abstract uploadReportFile$(
    orgId: OrganizationId,
    reportId: string,
    file: File,
    reportFileId: string,
  ): Observable<void>;

  /** GET /reports/organizations/{orgId}/data/summary?startDate=&endDate= */
  abstract getSummaryDataByDateRange$(
    orgId: OrganizationId,
    startDate: Date,
    endDate: Date,
  ): Observable<AccessReportSummaryApi[]>;

  /** PATCH /reports/organizations/{orgId}/data/summary/{reportId} */
  abstract updateSummaryData$(
    orgId: OrganizationId,
    reportId: string,
    summaryData: string | null,
    metrics?: Record<string, number>,
  ): Observable<AccessReportApi>;

  /** PATCH /reports/organizations/{orgId}/data/application/{reportId} */
  abstract updateApplicationData$(
    orgId: OrganizationId,
    reportId: string,
    applicationData: string | null,
  ): Observable<AccessReportApi>;
}
