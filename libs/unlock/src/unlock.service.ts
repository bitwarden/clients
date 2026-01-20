import { UserId } from "@bitwarden/common/types/guid";
import { DeviceKey } from "@bitwarden/common/types/key";
import { EncString, UnsignedSharedKey } from "@bitwarden/sdk-internal";

/**
 * Service for unlocking a user's account with various methods.
 */
export abstract class UnlockService {
    /**
     * Unlocks the user's account using their PIN.
     *
     * @param userId - The user's id
     * @param pin - The user's PIN
     * @throws If the SDK is not available
     * @throws If the PIN is invalid or decryption fails
     */
    abstract unlockWithPin(userId: UserId, pin: string): Promise<void>;

    /**
     * Unlocks the user's account using their master password.
     *
     * @param userId - The user's id
     * @param masterPassword - The user's master password
     * @throws If the SDK is not available
     * @throws If the master password is invalid or decryption fails
     */
    abstract unlockWithMasterPassword(userId: UserId, masterPassword: string): Promise<void>;

    /**
     * Unlocks the user's account using a device key (trusted device encryption).
     *
     * @param userId - The user's id
     * @param encryptedDevicePrivateKey - The encrypted device private key
     * @param encryptedUserKey - The device-protected user key
     * @param deviceKey - The device key
     * @throws If the SDK is not available
     * @throws If decryption fails
     */
    abstract unlockWithDeviceKey(
        userId: UserId,
        encryptedDevicePrivateKey: EncString,
        encryptedUserKey: UnsignedSharedKey,
        deviceKey: DeviceKey,
    ): Promise<void>;

    /**
     * Unlocks the user's account using an auth request (passwordless login).
     *
     * @param userId - The user's id
     * @param privateKey - The request private key
     * @param protectedUserKey - The protected user key from the auth request
     * @throws If the SDK is not available
     * @throws If decryption fails
     */
    abstract unlockWithAuthRequest(
        userId: UserId,
        privateKey: string,
        protectedUserKey: UnsignedSharedKey,
    ): Promise<void>;

    /**
     * Unlocks the user's account using a key connector.
     *
     * @param userId - The user's id
     * @param keyConnectorUrl - The URL of the key connector service
     * @throws If the SDK is not available
     * @throws If the key connector request fails or decryption fails
     */
    abstract unlockWithKeyConnector(userId: UserId, keyConnectorUrl: string): Promise<void>;
}
