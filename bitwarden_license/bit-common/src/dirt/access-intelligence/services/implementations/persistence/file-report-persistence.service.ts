import {
  catchError,
  firstValueFrom,
  from,
  map,
  Observable,
  of,
  switchMap,
  tap,
  throwError,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import {
  FileUploadApiMethods,
  FileUploadService,
} from "@bitwarden/common/platform/abstractions/file-upload/file-upload.service";
import { FileUploadType } from "@bitwarden/common/platform/enums";
import { OrganizationReportId, OrganizationId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import {
  AccessReportView,
  AccessReport,
  AccessReportData,
  AccessReportMetricsApi,
  AccessReportFileApi,
} from "../../../models";
import {
  AccessIntelligenceApiService,
  AccessReportCreateRequest,
  AccessReportSettingsUpdateRequest,
} from "../../abstractions/access-intelligence-api.service";
import { AccessReportEncryptionService } from "../../abstractions/access-report-encryption.service";
import { ReportPersistenceService } from "../../abstractions/report-persistence.service";

export class FileReportPersistenceService extends ReportPersistenceService {
  constructor(
    private accessIntelligenceApiService: AccessIntelligenceApiService,
    private riskInsightsEncryptionService: AccessReportEncryptionService,
    private accountService: AccountService,
    private logService: LogService,
    private fileUploadService: FileUploadService,
  ) {
    super();
  }

  saveReport$(
    view: AccessReportView,
    organizationId: OrganizationId,
  ): Observable<{ id: OrganizationReportId; contentEncryptionKey: EncString }> {
    this.logService.debug("[FileReportPersistenceService] Saving report", {
      organizationId,
    });

    return from(firstValueFrom(getUserId(this.accountService.activeAccount$))).pipe(
      switchMap((userId) => {
        // Encrypt view to domain model
        return from(
          AccessReport.fromView(view, this.riskInsightsEncryptionService, {
            organizationId,
            userId,
          }),
        ).pipe(
          switchMap((domain) => {
            if (!domain.contentEncryptionKey) {
              return throwError(() => new Error("Report encryption key not found"));
            }

            // Extract encrypted data from domain model
            const data = domain.toData();
            const metrics = view.toMetrics();

            const reportFile = new File([data.reports], "report-data.json", {
              type: "application/json",
            });

            const request = {
              applicationData: data.applications,
              summaryData: data.summary,
              contentEncryptionKey: data.contentEncryptionKey,
              metrics: metrics.toAccessReportMetricsData(),
              fileSize: reportFile.size,
            } as AccessReportCreateRequest;

            return this.accessIntelligenceApiService.createReport$(organizationId, request).pipe(
              tap((createReportResponse) => {
                const reportFileId = createReportResponse.reportResponse.reportFile?.id;
                if (!reportFileId) {
                  throw new Error(
                    "Report file ID was not found in create report response. Unable to upload report as file",
                  );
                }
              }),
              map((createReportResponse) => ({
                createReportResponse,
                reportFile,
                contentEncryptionKey: domain.contentEncryptionKey!,
              })),
            );
          }),
          switchMap(({ createReportResponse, reportFile, contentEncryptionKey }) => {
            const reportId = createReportResponse.reportResponse.id as OrganizationReportId;

            const upload$ = from(reportFile.bytes()).pipe(
              switchMap((buffer) =>
                from(
                  this.fileUploadService.uploadRaw(
                    {
                      url: createReportResponse.reportFileUploadUrl,
                      fileUploadType: createReportResponse.fileUploadType,
                    },
                    reportFile.name,
                    buffer,
                    this.generateFileUploadCallbacks(organizationId, createReportResponse),
                  ),
                ),
              ),
            );

            return upload$.pipe(map(() => ({ id: reportId, contentEncryptionKey })));
          }),
        );
      }),
    );
  }

  saveApplicationMetadata$(view: AccessReportView): Observable<void> {
    this.logService.debug("[FileReportPersistenceService] Saving application metadata", {
      reportId: view.id,
      organizationId: view.organizationId,
      applicationCount: view.applications.length,
    });

    return from(firstValueFrom(getUserId(this.accountService.activeAccount$))).pipe(
      switchMap((userId) => {
        // Encrypt view to domain model
        return from(
          AccessReport.fromView(view, this.riskInsightsEncryptionService, {
            organizationId: view.organizationId,
            userId,
          }),
        ).pipe(
          switchMap((domain) => {
            const data = domain.toData();
            const metrics = new AccessReportMetricsApi(
              view.toMetrics().toAccessReportMetricsData(),
            );

            const request: AccessReportSettingsUpdateRequest = {
              applicationData: data.applications,
              summaryData: data.summary,
              metrics: metrics,
            };

            return this.accessIntelligenceApiService.updateReportSettings$(
              view.organizationId,
              view.id,
              request,
            );
          }),
          map((_) => undefined as void),
        );
      }),
    );
  }

  loadReport$(
    organizationId: OrganizationId,
  ): Observable<{ report: AccessReportView; hadLegacyBlobs: boolean } | null> {
    this.logService.debug("[FileReportPersistenceService] Loading report", { organizationId });

    return from(firstValueFrom(getUserId(this.accountService.activeAccount$))).pipe(
      switchMap((userId) => {
        return this.accessIntelligenceApiService.getLatestReport$(organizationId).pipe(
          catchError((error: unknown) => {
            if (error instanceof ErrorResponse && error.statusCode === 404) {
              return of(null);
            }
            return throwError(() => error);
          }),
          switchMap((apiResponse) => {
            if (!apiResponse) {
              return of(null);
            }

            if (!apiResponse.contentEncryptionKey || apiResponse.contentEncryptionKey === "") {
              throw new Error("Report encryption key not found");
            }

            // V2: reportData lives in a file.
            //   - Azure blob URL → unauthenticated GET (SAS token in URL handles auth)
            //   - Server URL → authenticated API call
            // V1 fallback: reportData is inline in the response.
            let reportData$: Observable<string>;
            if (apiResponse.fileUploadType !== undefined && apiResponse.reportFileDownloadUrl) {
              reportData$ = (
                apiResponse.fileUploadType === FileUploadType.Azure
                  ? this.accessIntelligenceApiService.downloadReportFileAzure$(
                      apiResponse.reportFileDownloadUrl,
                    )
                  : this.accessIntelligenceApiService.downloadReportFile$(
                      organizationId,
                      apiResponse.id as OrganizationReportId,
                    )
              ).pipe(switchMap(({ blob }) => from(blob.text())));
            } else {
              reportData$ = of(apiResponse.reports);
            }

            return reportData$.pipe(
              switchMap((reportData) => {
                // Convert API → Data → Domain → View (following 4-layer architecture)
                const data = new AccessReportData(apiResponse);
                data.reports = reportData;

                const domain = new AccessReport(data);

                // Domain handles its own decryption
                return from(
                  domain.decrypt(this.riskInsightsEncryptionService, { organizationId, userId }),
                ).pipe(map(({ view, hadLegacyBlobs }) => ({ report: view, hadLegacyBlobs })));
              }),
            );
          }),
        );
      }),
    );
  }

  private generateFileUploadCallbacks(
    organizationId: OrganizationId,
    createReportResponse: AccessReportFileApi,
  ): FileUploadApiMethods {
    const reportId = createReportResponse.reportResponse.id as OrganizationReportId;
    const reportFileId = createReportResponse.reportResponse.reportFile?.id;

    return {
      postDirect: (fd: FormData) =>
        firstValueFrom(
          this.accessIntelligenceApiService.uploadReportFile$(
            organizationId,
            reportId,
            reportFileId!, // guaranteed a value since we throw error when not found in createReportResponse
            fd,
          ),
        ),
      renewFileUploadUrl: () =>
        firstValueFrom(
          this.accessIntelligenceApiService
            .renewReportFileUploadLink$(organizationId, reportId)
            .pipe(map((res) => res.reportFileUploadUrl)),
        ),
      rollback: () =>
        firstValueFrom(this.accessIntelligenceApiService.deleteReport$(organizationId, reportId)),
    };
  }
}
