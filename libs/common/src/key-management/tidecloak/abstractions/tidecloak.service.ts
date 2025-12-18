import { Observable } from "rxjs";

import { UserId } from "../../../types/guid";
import { MasterKey } from "../../../types/key";
import { NewSsoUserTideCloakConversion } from "../models/new-sso-user-tidecloak-conversion";
import { TideCloakDomainConfirmation } from "../models/tidecloak-domain-confirmation";

/**
 * Service for managing TideCloak key connector integration.
 * TideCloak uses Secure Multiparty Computation (SMPC) for key management,
 * where keys are never assembled on any single server - all decryption
 * happens client-side via the TideCloak SDK.
 */
export abstract class TideCloakService {
  /**
   * Decrypts the master key using TideCloak SMPC protocol.
   * This method uses the TideCloak SDK to perform distributed decryption
   * across ORK (Operational Recovery Key) nodes.
   * @param encryptedMasterKey - The encrypted master key stored on the server
   * @param tideCloakUrl - The TideCloak service URL for SDK initialization
   * @param userId - The user ID
   * @returns The decrypted master key
   */
  abstract decryptMasterKeyWithTideCloak(
    encryptedMasterKey: string,
    tideCloakUrl: string,
    userId: UserId,
  ): Promise<MasterKey>;

  /**
   * Encrypts a master key using TideCloak SMPC protocol.
   * This method uses the TideCloak SDK to perform distributed encryption
   * across ORK nodes.
   * @param masterKey - The master key to encrypt
   * @param tideCloakUrl - The TideCloak service URL for SDK initialization
   * @param userId - The user ID
   * @returns The encrypted master key for storage
   */
  abstract encryptMasterKeyWithTideCloak(
    masterKey: MasterKey,
    tideCloakUrl: string,
    userId: UserId,
  ): Promise<string>;

  /**
   * Checks if the user uses TideCloak for key management.
   * @param userId - The user ID
   * @returns True if the user is configured to use TideCloak
   */
  abstract getUsesTideCloak(userId: UserId): Promise<boolean>;

  /**
   * Sets whether the user uses TideCloak for key management.
   * @param usesTideCloak - Whether the user uses TideCloak
   * @param userId - The user ID
   */
  abstract setUsesTideCloak(usesTideCloak: boolean, userId: UserId): Promise<void>;

  /**
   * Converts a new SSO user to use TideCloak key management.
   * This generates a new master key, encrypts it via SMPC, and stores
   * the encrypted key on the server.
   * @param userId - The user ID
   */
  abstract convertNewSsoUserToTideCloak(userId: UserId): Promise<void>;

  /**
   * Sets the conversion data for a new SSO user that needs to be
   * converted to TideCloak key management.
   * @param conversion - The conversion data
   * @param userId - The user ID
   */
  abstract setNewSsoUserTideCloakConversionData(
    conversion: NewSsoUserTideCloakConversion,
    userId: UserId,
  ): Promise<void>;

  /**
   * Returns an observable that emits domain confirmation data when
   * a new SSO user needs to confirm their TideCloak domain.
   * @param userId - The user ID
   */
  abstract requiresDomainConfirmation$(
    userId: UserId,
  ): Observable<TideCloakDomainConfirmation | null>;

  /**
   * Sets the master key from TideCloak for an existing user.
   * Fetches the encrypted master key from the server and decrypts it
   * using the TideCloak SDK.
   * @param tideCloakUrl - The TideCloak service URL
   * @param encryptedMasterKey - The encrypted master key from the server
   * @param userId - The user ID
   */
  abstract setMasterKeyFromTideCloak(
    tideCloakUrl: string,
    encryptedMasterKey: string,
    userId: UserId,
  ): Promise<void>;
}
