import { CommandDefinition } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { UnlockMethod } from "@bitwarden/unlock";

/** An unlock one process performed, announced to the other so it can seed its SDK client. */
export type UnlockCompletedMessage = {
  userId: UserId;
  userKeyB64: string;
  method: UnlockMethod;
};

/** An unlock main performed, announced to the renderer. */
export const UNLOCK_COMPLETED = new CommandDefinition<UnlockCompletedMessage>("unlockCompleted");

/** An unlock the renderer performed, announced to main. */
export const RENDERER_UNLOCK_COMPLETED = new CommandDefinition<UnlockCompletedMessage>(
  "rendererUnlockCompleted",
);

/** A user key for one user, in a form that survives the IPC boundary. */
export type VaultState = {
  userKeyB64: string;
};

/** Response to `keyManagement.getUnlockSessions`: every account whose user key main currently holds. */
export type UnlockSessionsResponse = {
  unlocked: Record<UserId, VaultState>;
};

/**
 * The channel main pushes {@link UnlockSessionsResponse} on whenever the set of keys it holds
 * changes. It carries the whole set rather than a delta, so a renderer that missed a push, or
 * started late, is corrected by the next one instead of drifting.
 */
export const UNLOCK_SESSIONS_CHANGED_CHANNEL = "keyManagement.onUnlockSessionsChanged";

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
