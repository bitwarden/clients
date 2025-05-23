export type LogoutReason =
  | "invalidGrantError"
  | "vaultTimeout"
  | "invalidSecurityStamp"
  | "logoutNotification"
  | "keyConnectorError"
  | "sessionExpired"
  | "accessTokenUnableToBeDecrypted"
  | "refreshTokenSecureStorageRetrievalFailure"
  | "accountDeleted";
