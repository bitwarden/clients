export interface KeeperJsonExport {
  shared_folders?: SharedFoldersEntity[] | null;
  records?: RecordsEntity[] | null;
}

export interface SharedFoldersEntity {
  path: string;
  manage_users: boolean;
  manage_records: boolean;
  can_edit: boolean;
  can_share: boolean;
  permissions?: PermissionsEntity[] | null;
}

export interface PermissionsEntity {
  uid?: string | null;
  manage_users: boolean;
  manage_records: boolean;
  name?: string | null;
}

export interface RecordsEntity {
  title: string;
  login: string;
  password: string;
  login_url: string;
  notes?: string;
  custom_fields?: CustomFields;
  folders?: FoldersEntity[] | null;
}

export type CustomFields = {
  [key: string]: string | null;
};

export interface FoldersEntity {
  folder?: string | null;
  shared_folder?: string | null;
  can_edit?: boolean | null;
  can_share?: boolean | null;
}
