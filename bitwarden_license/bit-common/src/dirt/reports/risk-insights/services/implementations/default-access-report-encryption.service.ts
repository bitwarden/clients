import { Observable, catchError, forkJoin, from, map, switchMap, take } from "rxjs";

import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { EncryptedDataWithKey, EncryptedReportData } from "../../models";
import { RiskInsightsSummaryData } from "../../models/data/risk-insights-summary.data";
import {
  AccessReportEncryptionService,
  DecryptedAccessReportData,
} from "../abstractions/access-report-encryption.service";
import { BlobVersioningService } from "../abstractions/blob-versioning.service";

export class DefaultAccessReportEncryptionService extends AccessReportEncryptionService {
  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private keyGeneratorService: KeyGenerationService,
    private blobVersioningService: BlobVersioningService,
    private logService: LogService,
  ) {
    super();
  }

  encryptReport$(
    context: { organizationId: OrganizationId; userId: UserId },
    data: DecryptedAccessReportData,
    wrappedKey?: EncString,
  ): Observable<EncryptedDataWithKey> {
    this.logService.info("[DefaultAccessReportEncryptionService] Encrypting report");
    const { userId, organizationId } = context;

    return this.keyService.orgKeys$(userId).pipe(
      take(1),
      map((keys) => (keys ? keys[organizationId] : null)),
      switchMap((orgKey) => {
        if (!orgKey) {
          this.logService.warning(
            "[DefaultAccessReportEncryptionService] Attempted to encrypt without org key",
          );
          throw new Error("Organization key not found");
        }

        const contentKey$ = (
          wrappedKey
            ? from(this.encryptService.unwrapSymmetricKey(wrappedKey, orgKey))
            : from(this.keyGeneratorService.createKey(512))
        ).pipe(
          catchError((error: unknown) => {
            this.logService.error(
              "[DefaultAccessReportEncryptionService] Failed to get encryption key",
              error,
            );
            throw new Error("Failed to get encryption key");
          }),
        );

        return contentKey$.pipe(
          switchMap((contentEncryptionKey) => {
            const { reportData, summaryData, applicationData } = data;

            return forkJoin({
              encryptedReportData: from(
                this.encryptService.encryptString(
                  this.blobVersioningService.serializeReport(reportData),
                  contentEncryptionKey,
                ),
              ),
              encryptedSummaryData: from(
                this.encryptService.encryptString(
                  this.blobVersioningService.serializeSummary(summaryData),
                  contentEncryptionKey,
                ),
              ),
              encryptedApplicationData: from(
                this.encryptService.encryptString(
                  this.blobVersioningService.serializeApplication(applicationData),
                  contentEncryptionKey,
                ),
              ),
              wrappedEncryptionKey: from(
                this.encryptService.wrapSymmetricKey(contentEncryptionKey, orgKey),
              ),
            });
          }),
          map(
            ({
              encryptedReportData,
              encryptedSummaryData,
              encryptedApplicationData,
              wrappedEncryptionKey,
            }) => {
              if (
                !encryptedReportData.encryptedString ||
                !encryptedSummaryData.encryptedString ||
                !encryptedApplicationData.encryptedString ||
                !wrappedEncryptionKey.encryptedString
              ) {
                this.logService.error(
                  "[DefaultAccessReportEncryptionService] Encryption failed, encrypted strings are null",
                );
                throw new Error("Encryption failed, encrypted strings are null");
              }

              return {
                organizationId,
                encryptedReportData,
                encryptedSummaryData,
                encryptedApplicationData,
                contentEncryptionKey: wrappedEncryptionKey,
              } satisfies EncryptedDataWithKey;
            },
          ),
        );
      }),
    );
  }

  decryptReport$(
    context: { organizationId: OrganizationId; userId: UserId },
    encryptedData: EncryptedReportData,
    wrappedKey: EncString,
  ): Observable<DecryptedAccessReportData> {
    this.logService.info("[DefaultAccessReportEncryptionService] Decrypting report");
    const { userId, organizationId } = context;

    return this.keyService.orgKeys$(userId).pipe(
      take(1),
      map((keys) => (keys ? keys[organizationId] : null)),
      switchMap((orgKey) => {
        if (!orgKey) {
          this.logService.warning(
            "[DefaultAccessReportEncryptionService] Attempted to decrypt without org key",
          );
          throw new Error("Organization key not found");
        }

        return from(this.encryptService.unwrapSymmetricKey(wrappedKey, orgKey)).pipe(
          switchMap((contentEncryptionKey) => {
            if (!contentEncryptionKey) {
              this.logService.error(
                "[DefaultAccessReportEncryptionService] Encryption key not found",
              );
              throw new Error("Encryption key not found");
            }

            const { encryptedReportData, encryptedSummaryData, encryptedApplicationData } =
              encryptedData;

            return forkJoin({
              report: from(this._decryptBlob(encryptedReportData, contentEncryptionKey, "report")),
              summary: from(
                this._decryptBlob(encryptedSummaryData, contentEncryptionKey, "summary"),
              ),
              application: from(
                this._decryptBlob(encryptedApplicationData, contentEncryptionKey, "application"),
              ),
            }).pipe(
              map(({ report, summary, application }) => {
                const reportResult = this.blobVersioningService.processReport(report);
                const summaryResult = this.blobVersioningService.processSummary(summary);
                const applicationResult =
                  this.blobVersioningService.processApplication(application);

                const hadLegacyBlobs =
                  reportResult.wasV1 || summaryResult.wasV1 || applicationResult.wasV1;

                return {
                  version: 2 as const,
                  reportData: reportResult.data,
                  summaryData: summaryResult.data,
                  applicationData: applicationResult.data,
                  ...(hadLegacyBlobs ? { hadLegacyBlobs: true } : {}),
                };
              }),
            );
          }),
        );
      }),
    );
  }

  decryptSummary$(
    context: { organizationId: OrganizationId; userId: UserId },
    encryptedSummary: EncString,
    wrappedKey: EncString,
  ): Observable<RiskInsightsSummaryData> {
    this.logService.info("[DefaultAccessReportEncryptionService] Decrypting summary");
    const { userId, organizationId } = context;

    return this.keyService.orgKeys$(userId).pipe(
      take(1),
      map((keys) => (keys ? keys[organizationId] : null)),
      switchMap((orgKey) => {
        if (!orgKey) {
          this.logService.warning(
            "[DefaultAccessReportEncryptionService] Attempted to decrypt without org key",
          );
          throw new Error("Organization key not found");
        }

        return from(this.encryptService.unwrapSymmetricKey(wrappedKey, orgKey)).pipe(
          switchMap((contentEncryptionKey) => {
            if (!contentEncryptionKey) {
              this.logService.error(
                "[DefaultAccessReportEncryptionService] Encryption key not found",
              );
              throw new Error("Encryption key not found");
            }

            return from(this._decryptBlob(encryptedSummary, contentEncryptionKey, "summary")).pipe(
              map((json) => this.blobVersioningService.processSummary(json).data),
            );
          }),
        );
      }),
    );
  }

  private async _decryptBlob(
    encryptedData: EncString | null,
    key: SymmetricCryptoKey,
    blobType: "report" | "summary" | "application",
  ): Promise<unknown> {
    if (encryptedData == null) {
      if (blobType === "report") {
        throw new Error("Report data is missing. Run migration before loading this report.");
      }
      if (blobType === "summary") {
        throw new Error("Summary data not found");
      }
      // Application blob may be absent for new or migrating reports
      return [];
    }

    try {
      const decrypted = await this.encryptService.decryptString(encryptedData, key);
      return JSON.parse(decrypted);
    } catch (error: unknown) {
      this.logService.error(
        `[DefaultAccessReportEncryptionService] Failed to decrypt ${blobType} blob`,
        error,
      );
      throw new Error(
        `${blobType.charAt(0).toUpperCase() + blobType.slice(1)} data decryption failed. This may indicate data corruption or tampering.`,
      );
    }
  }
}
