import { Observable } from "rxjs";

import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";

import {
  AccessReportApi,
  AccessReportCreateApi,
  AccessReportFileApi,
  AccessReportSummaryApi,
} from "../../models";

export abstract class AccessIntelligenceApiService {
  /** GET /reports/organizations/{orgId}/latest */
  abstract getLatestReport$(orgId: OrganizationId): Observable<AccessReportApi>;

  /**
   * POST /reports/organizations/{orgId}
   */
  abstract createReport$(
    orgId: OrganizationId,
    request: AccessReportCreateApi,
  ): Observable<AccessReportFileApi>;

  /**
   * POST /reports/organizations/{orgId}/{reportId}/file/report-data
   * Self-hosted only. Uploads report data file via multipart form data.
   */
  abstract uploadReportFile$(
    orgId: OrganizationId,
    reportId: OrganizationReportId,
    file: File,
    reportFileId: string,
  ): Observable<void>;

  /** GET report data file from a blob storage download URL. Returns raw file text. */
  abstract downloadReportFile$(url: string): Observable<string>;

  /** GET /reports/organizations/{orgId}/{reportId}/file/download — Direct-upload file retrieval. */
  abstract getReportFileData$(orgId: OrganizationId, reportId: string): Observable<string>;

  /** GET /reports/organizations/{orgId}/data/summary?startDate=&endDate= */
  abstract getSummaryDataByDateRange$(
    orgId: OrganizationId,
    startDate: Date,
    endDate: Date,
  ): Observable<AccessReportSummaryApi[]>;

  /** PATCH /reports/organizations/{orgId}/data/summary/{reportId} */
  abstract updateSummaryData$(
    orgId: OrganizationId,
    reportId: OrganizationReportId,
    summaryData: string,
    metrics?: Record<string, number>,
  ): Observable<AccessReportApi>;

  /** PATCH /reports/organizations/{orgId}/data/application/{reportId} */
  abstract updateApplicationData$(
    orgId: OrganizationId,
    reportId: OrganizationReportId,
    applicationData: string,
  ): Observable<AccessReportApi>;

  /** GET /reports/organizations/{orgId}/{reportId}/renew-upload */
  abstract renewReportFileUpload$(
    orgId: OrganizationId,
    reportId: OrganizationReportId,
  ): Observable<AccessReportApi>;

  /** DELETE /reports/organizations/{orgId}/{reportId} */
  abstract deleteReport$(orgId: OrganizationId, reportId: OrganizationReportId): Observable<void>;
}
