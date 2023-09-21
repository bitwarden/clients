import { Verification } from "../../../types/verification";
import { SecretVerificationRequest } from "../../models/request/secret-verification.request";

export abstract class UserVerificationService {
  buildRequest: <T extends SecretVerificationRequest>(
    verification: Verification,
    requestClass?: new () => T,
    alreadyHashed?: boolean
  ) => Promise<T>;
  verifyUser: (verification: Verification) => Promise<boolean>;
  requestOTP: () => Promise<void>;
  /**
   * Check if user has master password or only uses passwordless technologies to log in
   * @param userId The user id to check. If not provided, the current user is used
   * @returns True if the user has a master password
   */
  hasMasterPassword: (userId?: string) => Promise<boolean>;
  /**
   * Check if the user has a master password and has used it during their current session
   * @param userId The user id to check. If not provided, the current user id used
   * @returns True if the user has a master password and has used it in the current session
   */
  hasMasterPasswordAndMasterKeyHash: (userId?: string) => Promise<boolean>;
}
