import {
  CipherWithIdExport,
  CollectionWithIdExport,
  FolderWithIdExport,
} from "@bitwarden/common/models/export";

// Base
export type BitwardenJsonExport = {
  encrypted: boolean;
  items: CipherWithIdExport[];
};

// Decrypted
export type BitwardenUnEncryptedJsonExport = BitwardenJsonExport & {
  encrypted: false;
};

export type BitwardenUnEncryptedIndividualJsonExport = BitwardenUnEncryptedJsonExport & {
  folders: FolderWithIdExport[];
};

export type BitwardenUnEncryptedOrgJsonExport = BitwardenUnEncryptedJsonExport & {
  collections: CollectionWithIdExport[];
};

// Account-encrypted
export type BitwardenEncryptedJsonExport = BitwardenJsonExport & {
  encrypted: true;
  encKeyValidation_DO_NOT_EDIT: string;
};

export type BitwardenEncryptedIndividualJsonExport = BitwardenEncryptedJsonExport & {
  folders: FolderWithIdExport[];
};

export type BitwardenEncryptedOrgJsonExport = BitwardenEncryptedJsonExport & {
  collections: CollectionWithIdExport[];
};

// Password-protected
export type BitwardenPasswordProtectedFileFormat = {
  encrypted: boolean;
  passwordProtected: boolean;
  salt: string;
  kdfIterations: number;
  kdfMemory?: number;
  kdfParallelism?: number;
  kdfType: number;
  encKeyValidation_DO_NOT_EDIT: string;
  data: string;
};
