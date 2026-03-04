import { Observable, catchError, forkJoin, from, map, switchMap, take } from "rxjs";

import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import {
  validateRiskInsightsApplicationDataArray,
  validateRiskInsightsSummaryData,
  validateAccessReportPayload,
} from "../../helpers/type-guards/risk-insights-type-guards";
import { EncryptedDataWithKey, EncryptedReportData } from "../../models";
import {
  AccessReportPayload,
  DecryptedAccessReportData,
  AccessReportEncryptionService,
  UnsupportedReportFormatError,
} from "../abstractions/access-report-encryption.service";

export class DefaultAccessReportEncryptionService extends AccessReportEncryptionService {
  /** Payload format version written into every new report blob. Bump when the blob structure changes. */
  private readonly CURRENT_REPORT_VERSION = 2;

  /**
   * Codec registry keyed by payload version number.
   * Add a new entry here when a new payload format is introduced — no other changes needed.
   */
  private readonly reportCodecs = new Map<
    number,
    { decode: (json: unknown) => AccessReportPayload }
  >([[2, { decode: (json: unknown) => validateAccessReportPayload(json) }]]);

  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private keyGeneratorService: KeyGenerationService,
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
                  JSON.stringify({ version: this.CURRENT_REPORT_VERSION, ...reportData }),
                  contentEncryptionKey,
                ),
              ),
              encryptedSummaryData: from(
                this.encryptService.encryptString(
                  JSON.stringify(summaryData),
                  contentEncryptionKey,
                ),
              ),
              encryptedApplicationData: from(
                this.encryptService.encryptString(
                  JSON.stringify(applicationData),
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
              reportData: from(this._decryptReportBlob(encryptedReportData, contentEncryptionKey)),
              summaryData: from(
                this._decryptSummaryBlob(encryptedSummaryData, contentEncryptionKey),
              ),
              applicationData: from(
                this._decryptApplicationBlob(encryptedApplicationData, contentEncryptionKey),
              ),
            });
          }),
          map(({ reportData, summaryData, applicationData }) => ({
            version: 2 as const,
            reportData,
            summaryData,
            applicationData,
          })),
        );
      }),
    );
  }

  private async _decryptReportBlob(encryptedData: EncString | null, key: SymmetricCryptoKey) {
    if (encryptedData == null) {
      throw new Error("Report data is missing. Run migration before loading this report.");
    }

    try {
      const decrypted = await this.encryptService.decryptString(encryptedData, key);
      const parsed = JSON.parse(decrypted);

      const codec = this.reportCodecs.get(parsed?.version);
      if (!codec) {
        throw new UnsupportedReportFormatError(parsed?.version);
      }

      return codec.decode(parsed);
    } catch (error: unknown) {
      this.logService.error(
        "[DefaultAccessReportEncryptionService] Failed to decrypt report blob",
        error,
      );
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "Report data validation failed. This may indicate data corruption or tampering.",
      );
    }
  }

  private async _decryptSummaryBlob(encryptedData: EncString | null, key: SymmetricCryptoKey) {
    if (encryptedData == null) {
      throw new Error("Summary data not found");
    }

    try {
      const decrypted = await this.encryptService.decryptString(encryptedData, key);
      return validateRiskInsightsSummaryData(JSON.parse(decrypted));
    } catch (error: unknown) {
      this.logService.error(
        "[DefaultAccessReportEncryptionService] Failed to decrypt summary blob",
        error,
      );
      throw new Error(
        "Summary data validation failed. This may indicate data corruption or tampering.",
      );
    }
  }

  private async _decryptApplicationBlob(encryptedData: EncString | null, key: SymmetricCryptoKey) {
    if (encryptedData == null) {
      return [];
    }

    try {
      const decrypted = await this.encryptService.decryptString(encryptedData, key);
      return validateRiskInsightsApplicationDataArray(JSON.parse(decrypted));
    } catch (error: unknown) {
      this.logService.error(
        "[DefaultAccessReportEncryptionService] Failed to decrypt application blob",
        error,
      );
      throw new Error(
        "Application data validation failed. This may indicate data corruption or tampering.",
      );
    }
  }
}
