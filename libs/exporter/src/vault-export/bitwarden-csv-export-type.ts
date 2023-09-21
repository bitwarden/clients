import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";

export type BitwardenCsvExportType = {
  type: string;
  name: string;
  notes: string;
  fields: string;
  reprompt: CipherRepromptType;
  // Login props
  login_uri: string[];
  login_username: string;
  login_password: string;
  login_totp: string;
  favorite: number | null;
};

export type BitwardenCsvIndividualExportType = BitwardenCsvExportType & {
  folder: string | null;
};

export type BitwardenCsvOrgExportType = BitwardenCsvExportType & {
  collections: string[] | null;
};
