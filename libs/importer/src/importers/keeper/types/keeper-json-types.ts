// See https://docs.keeper.io/en/user-guides/import-records-1/import-json#creating-a-custom-.json-file-for-import-into-keeper
// for reference on the Keeper JSON format. It's not comprehensive but covers the main fields.

export type KeeperJsonExport = {
  records?: Record[] | null | undefined;
  shared_folders?: SharedFolder[] | null | undefined;
};

export type Record = {
  $type?: string;

  uid?: string;
  title?: string;
  login?: string;
  password?: string;
  login_url?: string;
  notes?: string;
  last_modified?: number;
  custom_fields?: CustomFields;
  references?: References;
  folders?: Folder[];

  // Ignored at the moment
  schema?: any;
};

export type CustomFields = {
  [key: string]: any;
};

export type References = {
  [key: string]: any;
};

export type Folder = {
  shared_folder?: string;
  folder?: string;

  // Ignored at the moment
  can_edit?: boolean;
  can_share?: boolean;
};

export type SharedFolder = {
  uid?: string;
  path?: string;
  manage_users?: boolean;
  manage_records?: boolean;
  can_edit?: boolean;
  can_share?: boolean;

  // Ignored
  permissions?: any;
};
