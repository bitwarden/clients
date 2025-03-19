export enum BiometricAction {
  Authenticate = "authenticate",
  GetStatus = "status",

  UnlockForUser = "unlockForUser",
  GetStatusForUser = "statusForUser",
  SetKeyForUser = "setKeyForUser",
  RemoveKeyForUser = "removeKeyForUser",

  SetClientKeyHalf = "setClientKeyHalf",

  Setup = "setup",

  GetShouldAutoprompt = "getShouldAutoprompt",
  SetShouldAutoprompt = "setShouldAutoprompt",
}

export type BiometricMessage =
  | {
      action: BiometricAction.SetClientKeyHalf;
      userId: string;
      key: string | null;
    }
  | {
      action: BiometricAction.SetKeyForUser;
      userId: string;
      key: string;
    }
  | {
      action: Exclude<
        BiometricAction,
        BiometricAction.SetClientKeyHalf | BiometricAction.SetKeyForUser
      >;
      userId?: string;
      data?: any;
    };
