import {
  catchError,
  firstValueFrom,
  forkJoin,
  from,
  map,
  Observable,
  of,
  switchMap,
  throwError,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { FileUploadService } from "@bitwarden/common/platform/abstractions/file-upload/file-upload.service";
import { FileUploadType } from "@bitwarden/common/platform/enums";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { OrganizationReportId, OrganizationId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import {
  AccessReportView,
  AccessReport,
  AccessReportData,
  AccessReportApi,
  AccessReportMetricsApi,
} from "../../../models";
import { AccessIntelligenceApiService } from "../../abstractions/access-intelligence-api.service";
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
        if (!userId) {
          throw new Error("User ID not found");
        }

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

            const reportFile = new File([data.reports], "report-data.json", {
              type: "application/json",
            });

            const request = new AccessReportApi();
            request.applicationData = data.applications;
            request.summaryData = data.summary;
            request.contentEncryptionKey = data.contentEncryptionKey;
            request.fileSize = reportFile.size;

            return this.accessIntelligenceApiService.createReport$(organizationId, request).pipe(
              map((result) => ({
                result,
                reportFile,
                contentEncryptionKey: domain.contentEncryptionKey!,
              })),
            );
          }),
          switchMap(({ result, reportFile, contentEncryptionKey }) => {
            const reportId = result.reportResponse.id as OrganizationReportId;
            const reportFileId = result.reportResponse.reportFile ?? "";

            const upload$: Observable<void> =
              result.fileUploadType === FileUploadType.Azure
                ? from(reportFile.arrayBuffer()).pipe(
                    switchMap((buffer) =>
                      from(
                        this.fileUploadService.upload(
                          { url: result.reportFileUploadUrl, fileUploadType: FileUploadType.Azure },
                          new EncString(""),
                          { buffer: new Uint8Array(buffer) } as unknown as EncArrayBuffer,
                          {
                            postDirect: () => Promise.resolve(),
                            renewFileUploadUrl: () => Promise.resolve(result.reportFileUploadUrl),
                            rollback: () => Promise.resolve(),
                          },
                        ),
                      ),
                    ),
                  )
                : this.accessIntelligenceApiService.uploadReportFile$(
                    organizationId,
                    reportId,
                    reportFile,
                    reportFileId,
                  );

            return upload$.pipe(map(() => ({ id: reportId, contentEncryptionKey })));
          }),
        );
      }),
    );
  }

  saveApplicationMetadata$(view: AccessReportView): Observable<void> {
    this.logService.debug("[DefaultReportPersistenceService] Saving application metadata", {
      reportId: view.id,
      organizationId: view.organizationId,
      applicationCount: view.applications.length,
    });

    return from(firstValueFrom(getUserId(this.accountService.activeAccount$))).pipe(
      switchMap((userId) => {
        if (!userId) {
          throw new Error("User ID not found");
        }

        // Encrypt view to domain model
        return from(
          AccessReport.fromView(view, this.riskInsightsEncryptionService, {
            organizationId: view.organizationId,
            userId,
          }),
        ).pipe(
          switchMap((domain) => {
            const data = domain.toData();

            const updateApplicationsCall = this.accessIntelligenceApiService.updateApplicationData$(
              view.organizationId,
              view.id,
              data.applications,
            );

            const metrics = view.toMetrics().toAccessReportMetricsData();

            const updateSummaryCall = this.accessIntelligenceApiService.updateSummaryData$(
              view.organizationId,
              view.id,
              data.summary,
              metrics as AccessReportMetricsApi,
            );

            return forkJoin([updateApplicationsCall, updateSummaryCall]).pipe(
              map(() => undefined as void),
            );
          }),
        );
      }),
    );
  }

  loadReport$(
    organizationId: OrganizationId,
  ): Observable<{ report: AccessReportView; hadLegacyBlobs: boolean } | null> {
    this.logService.debug("[DefaultReportPersistenceService] Loading report", { organizationId });

    return from(firstValueFrom(getUserId(this.accountService.activeAccount$))).pipe(
      switchMap((userId) => {
        if (!userId) {
          throw new Error("User ID not found");
        }

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

            // V2: reportData lives in a file. Determine download strategy from the URL:
            //   - Azure blob URL → unauthenticated GET (SAS token in URL handles auth)
            //   - Server URL → authenticated API call
            // V1 fallback: reportData is inline in the response.
            let reportData$: Observable<string>;
            if (apiResponse.reportFileDownloadUrl) {
              const isAzure = new URL(apiResponse.reportFileDownloadUrl).hostname.includes(
                "blob.core.windows.net",
              );
              reportData$ = isAzure
                ? this.accessIntelligenceApiService.downloadReportFile$(
                    apiResponse.reportFileDownloadUrl,
                  )
                : this.accessIntelligenceApiService.getReportFileData$(
                    organizationId,
                    apiResponse.id,
                  );
            } else {
              reportData$ = of(apiResponse.reportData);
            }

            return reportData$.pipe(
              switchMap((reportData) => {
                // Convert API → Data → Domain → View (following 4-layer architecture)
                const data = new AccessReportData();
                data.id = apiResponse.id;
                data.organizationId = apiResponse.organizationId;
                data.reports = reportData;
                data.summary = apiResponse.summaryData;
                data.applications = apiResponse.applicationData;
                data.creationDate = apiResponse.creationDate;
                data.contentEncryptionKey = apiResponse.contentEncryptionKey;

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
}
