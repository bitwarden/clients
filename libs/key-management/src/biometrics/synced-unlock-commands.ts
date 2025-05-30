// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum SyncedUnlockStateCommands {
  IsConnected = "isConnected",
  SendLockToDesktop = "sendLockToDesktop",
  GetUserKeyFromDesktop = "getUserKeyFromDesktop",
  GetUserStatusFromDesktop = "getUserStatusFromDesktop",
  FocusDesktopApp = "focusDesktopApp",
  IsConnectionTrusted = "isConnectionTrusted",
}
