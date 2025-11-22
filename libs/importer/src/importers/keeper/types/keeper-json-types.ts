export type KeeperJsonExport = {
  records?: Record[] | null;
  shared_folders?: SharedFolder[] | null;
};

export type Record = {
  $type?: string;

  title?: string;
  login?: string;
  password?: string;
  login_url?: string;
  notes?: string;
  last_modified?: number;
  custom_fields?: CustomFields;
  folders?: Folder[];

  // Ignored at the moment
  uid?: string;
  schema?: any;
  references?: any;
};

export type CustomFields = {
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
