import { CommandDefinition } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { UnlockMethod } from "@bitwarden/unlock";

/** An unlock one process performed, announced to the other so it can seed its SDK client. */
export type UnlockCompletedMessage = {
  userId: UserId;
  userKeyB64: string;
  method: UnlockMethod;
};

export const UNLOCK_COMPLETED = new CommandDefinition<UnlockCompletedMessage>("unlockCompleted");

/** A user key for one user, in a form that survives the IPC boundary. */
export type VaultState = {
  userKeyB64: string;
};

/** Response to `keyManagement.getUnlockSessions`: every account whose user key main currently holds. */
export type UnlockSessionsResponse = {
  unlocked: Record<UserId, VaultState>;
};

/** Response to `keyManagement.unlock`: the freshly-decrypted user key, if one was produced. */
export type UnlockResponse = {
  userKeyB64: string | null;
};

/** Request to `keyManagement.unlock`, discriminated by the unlock method. */
export type UnlockRequest =
  | { userId: UserId; method: typeof UnlockMethod.Pin; pin: string }
  | {
      userId: UserId;
      method: typeof UnlockMethod.MasterPassword;
      password: string;
      // The renderer's master-password unlock data (JSON), sent to main so it can unlock during login.
      masterPasswordUnlockData: string | null;
    }
  | { userId: UserId; method: typeof UnlockMethod.Biometrics }
  | {
      userId: UserId;
      method: typeof UnlockMethod.KeyConnector;
      url: string;
      keyConnectorKeyWrappedUserKey: string;
    }
  | {
      userId: UserId;
      method: typeof UnlockMethod.DecryptedUserKey;
      userKeyB64: string;
      unlockMethod: UnlockMethod;
    }
  | { userId: UserId; method: typeof UnlockMethod.AutoKey };
