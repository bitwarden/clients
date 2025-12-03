// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum NotificationType {
  SyncCipherUpdate = 0,
  SyncCipherCreate = 1,
  SyncLoginDelete = 2,
  SyncFolderDelete = 3,
  SyncCiphers = 4,

  SyncVault = 5,
  SyncOrgKeys = 6,
  SyncFolderCreate = 7,
  SyncFolderUpdate = 8,
  SyncCipherDelete = 9,
  SyncSettings = 10,

  LogOut = 11,

  SyncSendCreate = 12,
  SyncSendUpdate = 13,
  SyncSendDelete = 14,

  AuthRequest = 15,
  AuthRequestResponse = 16,

  SyncOrganizations = 17,
  SyncOrganizationStatusChanged = 18,
  SyncOrganizationCollectionSettingChanged = 19,
  Notification = 20,
  NotificationStatus = 21,

  RefreshSecurityTasks = 22,

  OrganizationBankAccountVerified = 23,
  ProviderBankAccountVerified = 24,

  SyncPolicy = 25,
}
