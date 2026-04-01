export type LogoutReason =
  | "accessTokenUnableToBeDecrypted"
  | "accountDeleted"
  | "invalidAccessToken"
  | "invalidSecurityStamp"
  | "keyConnectorError"
  | "logoutNotification"
  | "refreshTokenSecureStorageRetrievalFailure"
  | "sessionExpired"
  | "vaultTimeout";
