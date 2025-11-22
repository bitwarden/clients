export type LogoutReason =
  | "accessTokenUnableToBeDecrypted"
  | "accountDeleted"
  | "invalidAccessToken"
  | "invalidSecurityStamp"
  | "keyConnectorError"
  | "logoutNotification"
  | "missingEmailError"
  | "refreshTokenSecureStorageRetrievalFailure"
  | "setInitialPassword"
  | "sessionExpired"
  | "userInitiated"
  | "vaultTimeout";
