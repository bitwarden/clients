import { Observable } from "rxjs";

import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";

import {
  AccessReportApi,
<<<<<<< dirt/file-persistence/pm-31942
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
=======
  AccessReportFileApi,
  AccessReportMetricsApi,
  AccessReportSummaryApi,
} from "../../models";

export interface AccessReportCreateRequest {
  contentEncryptionKey: string;
  summaryData: string;
  applicationData: string;
  metrics: AccessReportMetricsApi;
  fileSize: number;
}

export interface AccessReportLegacyCreateRequest {
  reportData: string;
  contentEncryptionKey: string;
  summaryData: string;
  applicationData: string;
  metrics: AccessReportMetricsApi;
}

export interface AccessReportSettingsUpdateRequest {
  summaryData: string;
  applicationData: string;
  metrics: AccessReportMetricsApi;
}

/**
 * Service handling server communication/API calls for Access Intelligence endpoints.
 *
 * Handles making HTTP requests to the Bitwarden server and transforms all responses into Api models. Source of truth for retrieving and updating Access Intelligence report data using the Bitwarden API.
 */
export abstract class AccessIntelligenceApiService {
  /**
   * Retrieves the latest Access Intelligence report for an Organization.
   * @param orgId - the ID of the Organization to retrieve the report for
   * @returns the latest Access Intelligence report
   */
  abstract getLatestReport$(orgId: OrganizationId): Observable<AccessReportApi>;

  /**
   * Creates an Access Intelligence report on the server, where the report contents are stored as a file.
   * @param orgId - the ID of the Organization to create the report for
   * @param request - contains data used to create the report
   * @returns observable emitting the server's response, which includes the created Access Intelligence report
   */
  abstract createReport$(
    orgId: OrganizationId,
    request: AccessReportCreateRequest,
  ): Observable<AccessReportFileApi>;

  /**
   * Creates an Access Intelligence report on the server, where report contents are included directly in the request body.
   * @param orgId - the ID of the Organization to create the report for
   * @param request - contains the report data and metadata used to create the report
   * @returns observable emitting the created Access Intelligence report
   */
  abstract createLegacyReport$(
    orgId: OrganizationId,
    request: AccessReportLegacyCreateRequest,
  ): Observable<AccessReportApi>;

  /**
   * Self-hosted only. Uploads a file containing the Access Intelligence report data directly to a Bitwarden self-hosted server.
   * @param orgId - the ID of the Organization the report belongs to
   * @param reportId - the ID of the report to upload the file for
   * @param file - the file containing the Access Intelligence report data
   * @param reportFileId - the ID of the report file returned from the server upon report creation
   * @returns observable that completes when the upload is successful
>>>>>>> main
   */
  abstract uploadReportFile$(
    orgId: OrganizationId,
    reportId: OrganizationReportId,
    file: File,
    reportFileId: string,
  ): Observable<void>;

<<<<<<< dirt/file-persistence/pm-31942
  /** GET report data file from a blob storage download URL. Returns raw file text. */
  abstract downloadReportFile$(url: string): Observable<string>;

  /** GET /reports/organizations/{orgId}/{reportId}/file/download — Direct-upload file retrieval. */
  abstract getReportFileData$(orgId: OrganizationId, reportId: string): Observable<string>;

  /** GET /reports/organizations/{orgId}/data/summary?startDate=&endDate= */
=======
  /**
   * Retrieves Access Intelligence summary data for an Organization within a date range.
   * @param orgId - the ID of the Organization to retrieve summary data for
   * @param startDate - the start of the date range (inclusive)
   * @param endDate - the end of the date range (inclusive)
   * @returns observable emitting an array of summary data records within the given date range
   */
>>>>>>> main
  abstract getSummaryDataByDateRange$(
    orgId: OrganizationId,
    startDate: Date,
    endDate: Date,
  ): Observable<AccessReportSummaryApi[]>;

<<<<<<< dirt/file-persistence/pm-31942
  /** PATCH /reports/organizations/{orgId}/data/summary/{reportId} */
=======
  /**
   * Updates the summary data for an existing Access Intelligence report.
   * @param orgId - the ID of the Organization the report belongs to
   * @param reportId - the ID of the report to update
   * @param summaryData - the encrypted summary data to store on the report
   * @param metrics - optional map of metric names to their values
   * @returns observable emitting the updated Access Intelligence report
   */
>>>>>>> main
  abstract updateSummaryData$(
    orgId: OrganizationId,
    reportId: OrganizationReportId,
    summaryData: string,
<<<<<<< dirt/file-persistence/pm-31942
    metrics?: Record<string, number>,
  ): Observable<AccessReportApi>;

  /** PATCH /reports/organizations/{orgId}/data/application/{reportId} */
=======
    metrics?: AccessReportMetricsApi,
  ): Observable<AccessReportApi>;

  /**
   * Updates the application data for an existing Access Intelligence report.
   * @param orgId - the ID of the Organization the report belongs to
   * @param reportId - the ID of the report to update
   * @param applicationData - the encrypted application data to store on the report
   * @returns observable emitting the updated Access Intelligence report
   */
>>>>>>> main
  abstract updateApplicationData$(
    orgId: OrganizationId,
    reportId: OrganizationReportId,
    applicationData: string,
  ): Observable<AccessReportApi>;

<<<<<<< dirt/file-persistence/pm-31942
  /** GET /reports/organizations/{orgId}/{reportId}/file/renew */
=======
  /**
   * Renews the upload link for an Access Intelligence report file. Used when a prior upload attempt failed or expired.
   * @param orgId - the ID of the Organization the report belongs to
   * @param reportId - the ID of the report whose upload link should be renewed
   * @returns observable emitting the renewed report file metadata, including a fresh upload URL
   */
>>>>>>> main
  abstract renewReportFileUploadLink$(
    orgId: OrganizationId,
    reportId: OrganizationReportId,
  ): Observable<AccessReportFileApi>;

<<<<<<< dirt/file-persistence/pm-31942
  /** DELETE /reports/organizations/{orgId}/{reportId} */
  abstract deleteReport$(orgId: OrganizationId, reportId: OrganizationReportId): Observable<void>;
=======
  /**
   * Deletes an Access Intelligence report from the server.
   * @param orgId - the ID of the Organization the report belongs to
   * @param reportId - the ID of the report to delete
   * @returns observable that completes when the report has been deleted
   */
  abstract deleteReport$(orgId: OrganizationId, reportId: OrganizationReportId): Observable<void>;

  /**
   * Self-hosted only. Downloads the file for an Access Intelligence report.
   * @param orgId - the ID of the Organization the report belongs to
   * @param reportId - the ID of the report whose file to download
   * @returns observable emitting the file blob and its filename
   */
  abstract downloadReportFile$(
    orgId: OrganizationId,
    reportId: OrganizationReportId,
  ): Observable<{ blob: Blob; fileName: string }>;

  /**
   * Update the settings properties for an existing Access Intelligence report.
   * @param orgId - the ID of the Organization the report belongs to
   * @param reportId - the ID of the report to update
   * @param request - the data to update on the report
   * @returns observable emitting the updated Access Intelligence report
   */
  abstract updateReportSettings$(
    orgId: OrganizationId,
    reportId: OrganizationReportId,
    request: AccessReportSettingsUpdateRequest,
  ): Observable<AccessReportApi>;
>>>>>>> main
}
