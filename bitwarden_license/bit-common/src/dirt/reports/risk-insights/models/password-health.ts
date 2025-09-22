// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { BadgeVariant } from "@bitwarden/components";
import { EncString } from "@bitwarden/sdk-internal";

import { ApplicationHealthReportDetail } from "./report-models";

/**
 * Weak password details containing the score
 * and the score type for the label and badge
 */
export type WeakPasswordDetail = {
  score: number;
  detailValue: WeakPasswordScore;
} | null;

/**
 * Weak password details containing the badge and
 * the label for the password score
 */
export type WeakPasswordScore = {
  label: string;
  badgeVariant: BadgeVariant;
} | null;

/**
 * How many times a password has been exposed
 */
export type ExposedPasswordDetail = {
  cipherId: string;
  exposedXTimes: number;
} | null;

/*
 * After data is encrypted, it is returned with the
 * encryption key used to encrypt the data.
 */
export interface EncryptedDataWithKey {
  organizationId: OrganizationId;
  encryptedData: EncString;
  encryptionKey: EncString;
}

export type LEGACY_MemberDetailsFlat = {
  userGuid: string;
  userName: string;
  email: string;
  cipherId: string;
};

export type LEGACY_ApplicationHealthReportDetailWithCriticalFlag = ApplicationHealthReportDetail & {
  isMarkedAsCritical: boolean;
};

export type LEGACY_ApplicationHealthReportDetailWithCriticalFlagAndCipher =
  LEGACY_ApplicationHealthReportDetailWithCriticalFlag & {
    ciphers: CipherView[];
  };

export type LEGACY_CipherHealthReportDetail = CipherView & {
  reusedPasswordCount: number;
  weakPasswordDetail: WeakPasswordDetail;
  exposedPasswordDetail: ExposedPasswordDetail;
  cipherMembers: LEGACY_MemberDetailsFlat[];
  trimmedUris: string[];
};

export type LEGACY_CipherHealthReportUriDetail = {
  cipherId: string;
  reusedPasswordCount: number;
  weakPasswordDetail: WeakPasswordDetail;
  exposedPasswordDetail: ExposedPasswordDetail;
  cipherMembers: LEGACY_MemberDetailsFlat[];
  trimmedUri: string;
  cipher: CipherView;
};

export interface EncryptedDataModel {
  organizationId: OrganizationId;
  encryptedData: string;
  encryptionKey: string;
  date: Date;
}
