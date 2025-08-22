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
}

export type BiometricMessage =
  | {
      action: BiometricAction.SetKeyForUser;
      userId: string;
      key: string;
    }
  | {
      action: Exclude<BiometricAction, BiometricAction.SetKeyForUser>;
      userId?: string;
      data?: any;
    };
