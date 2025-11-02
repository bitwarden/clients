// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum BiometricAction {
  Authenticate = "authenticate",
  GetStatus = "status",

  UnlockForUser = "unlockForUser",
  GetStatusForUser = "statusForUser",
  SetKeyForUser = "setKeyForUser",
  RemoveKeyForUser = "removeKeyForUser",

  Setup = "setup",

  GetShouldAutoprompt = "getShouldAutoprompt",
  SetShouldAutoprompt = "setShouldAutoprompt",

  EnrollPersistent = "enrollPersistent",
  HasPersistentKey = "hasPersistentKey",

  EnableWindowsV2 = "enableWindowsV2",
  IsWindowsV2Enabled = "isWindowsV2Enabled",

  EnableLinuxV2 = "enableLinuxV2",
  IsLinuxV2Enabled = "isLinuxV2Enabled",
}

export type BiometricMessage =
  | {
      action: BiometricAction.SetKeyForUser;
      userId: string;
      key: string;
    }
  | {
      action: BiometricAction.EnrollPersistent;
      userId: string;
      key: string;
    }
  | {
      action: Exclude<
        BiometricAction,
        BiometricAction.SetKeyForUser | BiometricAction.EnrollPersistent
      >;
      userId?: string;
      data?: any;
    };
