import { Observable, catchError, forkJoin, from, map, switchMap, take } from "rxjs";

import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { AccessReportSummaryView } from "../../../models";
import {
  AccessReportEncryptionService,
  DecryptedAccessReportData,
  EncryptedDataWithKey,
  EncryptedReportData,
} from "../../abstractions/access-report-encryption.service";

import { ApplicationVersioningService } from "./versioning/application-versioning.service";
import { ReportVersioningService } from "./versioning/report-versioning.service";
import { SummaryVersioningService } from "./versioning/summary-versioning.service";

export class DefaultAccessReportEncryptionService extends AccessReportEncryptionService {
  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private keyGeneratorService: KeyGenerationService,
    private reportVersioningService: ReportVersioningService,
    private applicationVersioningService: ApplicationVersioningService,
    private summaryVersioningService: SummaryVersioningService,
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
                  this.reportVersioningService.serialize(reportData),
                  contentEncryptionKey,
                ),
              ),
              encryptedSummaryData: from(
                this.encryptService.encryptString(
                  this.summaryVersioningService.serialize(summaryData),
                  contentEncryptionKey,
                ),
              ),
              encryptedApplicationData: from(
                this.encryptService.encryptString(
                  this.applicationVersioningService.serialize(applicationData),
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
                const reportResult = this.reportVersioningService.process(report);
                const summaryResult = this.summaryVersioningService.process(summary);
                const applicationResult = this.applicationVersioningService.process(application);

                const hadLegacyBlobs =
                  reportResult.wasLegacy || summaryResult.wasLegacy || applicationResult.wasLegacy;

                return {
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
  ): Observable<AccessReportSummaryView> {
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
              map((json) => this.summaryVersioningService.process(json).data),
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
