import { Observable } from "rxjs";

import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";

import { EncryptedDataWithKey, EncryptedReportData } from "../../models";
import { RiskInsightsApplicationData } from "../../models/data/risk-insights-application.data";
import {
  MemberRegistryEntryData,
  RiskInsightsReportData,
} from "../../models/data/risk-insights-report.data";
import { RiskInsightsSummaryData } from "../../models/data/risk-insights-summary.data";

/**
 * Thrown when an encrypted report blob cannot be decoded by any registered codec.
 *
 * - No version field in the blob → legacy format (V1), migration may be possible.
 * - Known version that has no registered codec → application needs to be updated.
 */
export class UnsupportedReportFormatError extends Error {
  constructor(readonly foundVersion: number | undefined) {
    super(
      foundVersion === undefined
        ? "Legacy report detected, migration required."
        : "Report version not supported.",
    );
    this.name = "UnsupportedReportFormatError";
  }

  /** True when the blob predates versioning (no version field — V1 format). */
  get isLegacyFormat(): boolean {
    return this.foundVersion === undefined;
  }
}

/**
 * The decrypted report payload stored inside the encrypted reports blob.
 *
 * Contains the full collection of ApplicationHealth entries and the deduplicated
 * MemberRegistry for the AccessReport.
 *
 * Note: `version` is part of the stored JSON and is validated before this type is
 * applied — see `validateAccessReportPayload()`. It is not carried as a TypeScript
 * discriminant here because callers receive a validated, already-version-checked value.
 *
 * @example { reports: [...], memberRegistry: { "user-id": { id, userName, email } } }
 */
export interface AccessReportPayload {
  reports: RiskInsightsReportData[];
  memberRegistry: Record<string, MemberRegistryEntryData>;
}

/**
 * The three decrypted payloads that make up a complete AccessReport:
 * the report payload (ApplicationHealth entries + MemberRegistry), the summary aggregates,
 * and the per-app settings.
 */
export interface DecryptedAccessReportData {
  version: 2;
  reportData: AccessReportPayload;
  summaryData: RiskInsightsSummaryData;
  applicationData: RiskInsightsApplicationData[];
}

/**
 * Encrypts and decrypts AccessReport payloads using a wrapped content key
 * stored alongside the encrypted blobs.
 */
export abstract class AccessReportEncryptionService {
  /**
   * Encrypts an AccessReport payload and emits the encrypted blobs with wrapped key.
   *
   * @param context - The organization and user identifiers for key lookup.
   * @param data - The decrypted report, summary, and application data to encrypt.
   * @param wrappedKey - An existing wrapped content key to reuse; omit to generate a new key.
   * @returns Observable emitting the encrypted blobs and wrapped content key.
   */
  abstract encryptReport$(
    context: { organizationId: OrganizationId; userId: UserId },
    data: DecryptedAccessReportData,
    wrappedKey?: EncString,
  ): Observable<EncryptedDataWithKey>;

  /**
   * Decrypts an encrypted AccessReport and emits the structured report, summary,
   * and application data.
   *
   * @param context - The organization and user identifiers for key lookup.
   * @param encryptedData - The three encrypted blobs to decrypt.
   * @param wrappedKey - The wrapped content key stored alongside the report.
   * @returns Observable emitting the decrypted report, summary, and application data.
   */
  abstract decryptReport$(
    context: { organizationId: OrganizationId; userId: UserId },
    encryptedData: EncryptedReportData,
    wrappedKey: EncString,
  ): Observable<DecryptedAccessReportData>;

  /**
   * Decrypts a standalone encrypted summary blob and emits the summary aggregates.
   *
   * Used when only the summary is needed (e.g., dashboard load) without fetching
   * the full report payload.
   *
   * @param context - The organization and user identifiers for key lookup.
   * @param encryptedSummary - The encrypted summary blob to decrypt.
   * @param wrappedKey - The wrapped content key stored alongside the summary.
   * @returns Observable emitting the decrypted summary data.
   */
  abstract decryptSummary$(
    context: { organizationId: OrganizationId; userId: UserId },
    encryptedSummary: EncString,
    wrappedKey: EncString,
  ): Observable<RiskInsightsSummaryData>;
}
