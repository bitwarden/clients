export type PsonoItemTypes =
  | WebsitePasswordEntry
  | AppPasswordEntry
  | TOTPEntry
  | NotesEntry
  | EnvironmentVariablesEntry
  | GPGEntry
  | BookmarkEntry;

export interface PsonoJsonExport {
  folders?: FoldersEntity[];
  items?: PsonoItemTypes[];
}

export interface FoldersEntity {
  name: string;
  items?: PsonoItemTypes[] | null;
  folders?: FoldersEntity[] | null;
}

export interface RecordBase {
  type: PsonoEntryTypes;
  name: string;
  create_date: string;
  write_date: string;
  callback_url: string;
  callback_user: string;
  callback_pass: string;
}

export type PsonoEntryTypes =
  | "website_password"
  | "bookmark"
  | "mail_gpg_own_key"
  | "environment_variables"
  | "note"
  | "application_password"
  | "totp";

export interface WebsitePasswordEntry extends RecordBase {
  type: "website_password";
  autosubmit?: boolean;
  urlfilter?: string;
  website_password_title: string;
  website_password_url: string;
  website_password_username: string;
  website_password_password: string;
  website_password_notes: string;
  website_password_auto_submit?: boolean;
  website_password_url_filter?: string;
}

export interface PsonoEntry {
  type: string;
  name: string;
}

export interface BookmarkEntry extends RecordBase {
  type: "bookmark";
  urlfilter: string;
  bookmark_title: string;
  bookmark_url: string;
  bookmark_notes: string;
  bookmark_url_filter: string;
}

export interface GPGEntry extends RecordBase {
  type: "mail_gpg_own_key";
  mail_gpg_own_key_title: string;
  mail_gpg_own_key_email: string;
  mail_gpg_own_key_name: string;
  mail_gpg_own_key_public: string;
  mail_gpg_own_key_private: string;
}

export interface EnvironmentVariablesEntry extends RecordBase {
  type: "environment_variables";
  environment_variables_title: string;
  environment_variables_variables: EnvironmentVariables_KVPair[];
  environment_variables_notes: string;
}

export interface EnvironmentVariables_KVPair {
  key: string;
  value: string;
}

export interface AppPasswordEntry extends RecordBase {
  type: "application_password";
  application_password_title: string;
  application_password_username: string;
  application_password_password: string;
  application_password_notes: string;
}

export interface TOTPEntry extends RecordBase {
  type: "totp";
  totp_title: string;
  totp_period: number;
  totp_algorithm: "SHA1";
  totp_digits: number;
  totp_code: string;
  totp_notes: string;
}

export interface NotesEntry extends RecordBase {
  type: "note";
  note_title: string;
  note_notes: string;
}
