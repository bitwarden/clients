import {
  CipherWithIdExport,
  CollectionWithIdExport,
  FolderWithIdExport,
} from "@bitwarden/common/models/export";

// Base
export type BitwardenJsonExport = BitwardenUnEncryptedJsonExport | BitwardenEncryptedJsonExport;

// Decrypted
export type BitwardenUnEncryptedJsonExport =
  | BitwardenUnEncryptedIndividualJsonExport
  | BitwardenUnEncryptedOrgJsonExport;

export type BitwardenUnEncryptedIndividualJsonExport = {
  encrypted: false;
  items: CipherWithIdExport[];
  folders: FolderWithIdExport[];
};

export type BitwardenUnEncryptedOrgJsonExport = {
  encrypted: false;
  items: CipherWithIdExport[];
  collections: CollectionWithIdExport[];
};

// Account-encrypted
export type BitwardenEncryptedJsonExport =
  | BitwardenEncryptedIndividualJsonExport
  | BitwardenEncryptedOrgJsonExport;

export type BitwardenEncryptedIndividualJsonExport = {
  encrypted: true;
  encKeyValidation_DO_NOT_EDIT: string;
  items: CipherWithIdExport[];
  folders: FolderWithIdExport[];
};

export type BitwardenEncryptedOrgJsonExport = {
  encrypted: true;
  encKeyValidation_DO_NOT_EDIT: string;
  items: CipherWithIdExport[];
  collections: CollectionWithIdExport[];
};

// Password-protected
export type BitwardenPasswordProtectedFileFormat = {
  encrypted: true;
  passwordProtected: true;
  salt: string;
  kdfIterations: number;
  kdfMemory?: number;
  kdfParallelism?: number;
  kdfType: number;
  encKeyValidation_DO_NOT_EDIT: string;
  data: string;
};

// Unencrypted type guards
export function isUnencrypted(
  data: BitwardenJsonExport | null | undefined,
): data is BitwardenUnEncryptedJsonExport {
  return data != null && (data as { encrypted?: unknown }).encrypted !== true;
}

export function isIndividualUnEncrypted(
  data: BitwardenJsonExport | null | undefined,
): data is BitwardenUnEncryptedIndividualJsonExport {
  return isUnencrypted(data) && (data as { folders?: unknown }).folders != null;
}

export function isOrgUnEncrypted(
  data: BitwardenJsonExport | null | undefined,
): data is BitwardenUnEncryptedOrgJsonExport {
  return isUnencrypted(data) && (data as { collections?: unknown }).collections != null;
}

// Encrypted type guards
export function isEncrypted(
  data: BitwardenJsonExport | null | undefined,
): data is BitwardenEncryptedJsonExport {
  return data != null && (data as { encrypted?: unknown }).encrypted === true;
}
export function isPasswordProtected(
  data: BitwardenPasswordProtectedFileFormat | BitwardenJsonExport | null | undefined,
): data is BitwardenPasswordProtectedFileFormat {
  return (
    data != null &&
    (data as { encrypted?: unknown }).encrypted === true &&
    (data as { passwordProtected?: unknown }).passwordProtected === true
  );
}

export function isIndividualEncrypted(
  data: BitwardenJsonExport | null | undefined,
): data is BitwardenEncryptedIndividualJsonExport {
  return isEncrypted(data) && (data as { folders?: unknown }).folders != null;
}

export function isOrgEncrypted(
  data: BitwardenJsonExport | null | undefined,
): data is BitwardenEncryptedOrgJsonExport {
  return isEncrypted(data) && (data as { collections?: unknown }).collections != null;
}
