import { UserId } from "@bitwarden/common/types/guid";

import { PinLockType } from "@bitwarden/common/key-management/pin/pin-lock-type";

/**
 * Service for unlocking a user's account with various methods.
 */
export abstract class UnlockService {
    /**
     * Unlocks the user's account using their PIN.
     *
     * @param userId - The user's id
     * @param pin - The user's PIN
     * @param pinLockType - The type of PIN lock (PERSISTENT or EPHEMERAL)
     * @throws If the SDK is not available
     * @throws If the PIN is invalid or decryption fails
     */
    abstract unlockWithPin(userId: UserId, pin: string, pinLockType: PinLockType): Promise<void>;
}
