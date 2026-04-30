import { Observable } from "rxjs";

import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";

import {
  MemberRegistryEntryData,
  AccessReportSettingsData,
  ApplicationHealthData,
  AccessReportSummaryView,
} from "../../models";

/**
 * The three encrypted payloads that make up a stored AccessReport.
 * Passed to {@link AccessReportEncryptionService.decryptReport$} to obtain the decrypted data.
 */
export interface EncryptedReportData {
  encryptedReportData: EncString;
  encryptedSummaryData: EncString;
  encryptedApplicationData: EncString;
}

/**
 * The result of encrypting an AccessReport: the three encrypted payloads plus
 * the wrapped content key and the organization identifier.
 * Returned by {@link AccessReportEncryptionService.encryptReport$}.
 */
export interface EncryptedDataWithKey {
  organizationId: OrganizationId;
  encryptedReportData: EncString;
  encryptedSummaryData: EncString;
  encryptedApplicationData: EncString;
  contentEncryptionKey: EncString;
}

/**
 * The decrypted report payload stored inside the encrypted report payload.
 *
 * Contains the full collection of ApplicationHealth entries and the deduplicated
 * MemberRegistry for the AccessReport.
 *
 * @example { reports: [...], memberRegistry: { "user-id": { id, userName, email } } }
 */
export interface AccessReportPayload {
  reports: ApplicationHealthData[];
  memberRegistry: Record<string, MemberRegistryEntryData>;
}

/**
 * The three decrypted payloads that make up a complete AccessReport:
 * the report payload (ApplicationHealth entries + MemberRegistry), the summary aggregates,
 * and the per-app settings.
 *
 * `hadLegacyBlobs` is set to `true` when any of the three payloads was in V1 format at decrypt
 * time. Callers should re-save the report so all payloads are written in the current format.
 */
export interface DecryptedAccessReportData {
  reportData: AccessReportPayload;
  summaryData: AccessReportSummaryView;
  applicationData: AccessReportSettingsData[];
  hadLegacyBlobs?: boolean;
}

/**
 * Encrypts and decrypts AccessReport payloads using a wrapped content key
 * stored alongside the encrypted payloads.
 */
export abstract class AccessReportEncryptionService {
  /**
   * Encrypts an AccessReport payload and emits the encrypted payloads with wrapped key.
   *
   * @param context - The organization and user identifiers for key lookup.
   * @param data - The decrypted report, summary, and application data to encrypt.
   * @param wrappedKey - An existing wrapped content key to reuse; omit to generate a new key.
   * @returns Observable emitting the encrypted payloads and wrapped content key.
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
   * @param encryptedData - The three encrypted payloads to decrypt.
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
  ): Observable<AccessReportSummaryView>;
}
