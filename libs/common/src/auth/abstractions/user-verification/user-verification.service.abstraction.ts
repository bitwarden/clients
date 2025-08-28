import { UserId } from "../../../types/guid";
import { SecretVerificationRequest } from "../../models/request/secret-verification.request";
import { UserVerificationOptions } from "../../types/user-verification-options";
import {
  MasterPasswordVerification,
  MasterPasswordVerificationResponse,
  Verification,
} from "../../types/verification";

export abstract class UserVerificationService {
  /**
   * Returns the available verification options for the user, can be
   * restricted to a specific type of verification.
   * @param verificationType Type of verification to restrict the options to
   * @returns Available verification options for the user
   */
  abstract getAvailableVerificationOptions(
    verificationType: keyof UserVerificationOptions,
  ): Promise<UserVerificationOptions>;
  /**
   * Create a new request model to be used for server-side verification
   * @param verification User-supplied verification data (Master Password or OTP)
   * @param requestClass The request model to create
   * @param alreadyHashed Whether the master password is already hashed
   * @throws Error if the verification data is invalid
   */
  abstract buildRequest<T extends SecretVerificationRequest>(
    verification: Verification,
    requestClass?: new () => T,
    alreadyHashed?: boolean,
  ): Promise<T>;
  /**
   * Verifies the user using the provided verification data.
   * PIN or biometrics are verified client-side.
   * OTP is sent to the server for verification (with no other data)
   * Master Password verifies client-side first if there is a MP hash, or server-side if not.
   * @param verification User-supplied verification data (OTP, MP, PIN, or biometrics)
   * @throws Error if the verification data is invalid or the verification fails
   */
  abstract verifyUser(verification: Verification): Promise<boolean>;
  /**
   * Request a one-time password (OTP) to be sent to the user's email
   */
  abstract requestOTP(): Promise<void>;
  /**
   * Check if user has master password or can only use passwordless technologies to log in
   * Note: This only checks the server, not the local state
   * @param userId The user id to check. If not provided, the current user is used
   * @returns True if the user has a master password
   * @deprecated Use UserDecryptionOptionsService.hasMasterPassword$ instead
   */
  abstract hasMasterPassword(userId?: string): Promise<boolean>;
  /**
   * Check if the user has a master password and has used it during their current session
   * @param userId The user id to check. If not provided, the current user id used
   * @returns True if the user has a master password and has used it in the current session
   */
  abstract hasMasterPasswordAndMasterKeyHash(userId?: string): Promise<boolean>;
  /**
   * Verifies the user using the provided master password.
   * Attempts to verify client-side first, then server-side if necessary.
   * IMPORTANT: Will throw an error if the master password is invalid.
   * @param verification Master Password verification data
   * @param userId The user to verify
   * @param email The user's email
   * @throws Error if the master password is invalid
   * @returns An object containing the master key, and master password policy options if verified on server.
   */
  abstract verifyUserByMasterPassword(
    verification: MasterPasswordVerification,
    userId: UserId,
    email: string,
  ): Promise<MasterPasswordVerificationResponse>;
}
