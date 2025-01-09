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

export type BiometricMessage = {
  action: BiometricAction;
  key?: string;
  userId?: string;
  data?: any;
};
