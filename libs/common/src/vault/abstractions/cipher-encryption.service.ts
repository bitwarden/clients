import { CipherListView } from "@bitwarden/sdk-internal";

import { UserId } from "../../types/guid";
import { Cipher } from "../models/domain/cipher";
import { CipherView } from "../models/view/cipher.view";

/**
 * Service responsible for encrypting and decrypting ciphers.
 */
export abstract class CipherEncryptionService {
  /**
   * Decrypts a cipher using the SDK for the given userId.
   *
   * @param cipher The encrypted cipher object
   * @param userId The user ID whose key will be used for decryption
   *
   * @returns A promise that resolves to the decrypted cipher view
   */
  abstract decrypt(cipher: Cipher, userId: UserId): Promise<CipherView>;
  /**
   * Decrypts a list of ciphers using the SDK for the given userId.
   *
   * @param ciphers The encrypted cipher objects
   * @param userId The user ID whose key will be used for decryption
   *
   * @returns A promise that resolves to an array of decrypted cipher list views
   */
  abstract decryptCipherList(ciphers: Cipher[], userId: UserId): Promise<CipherListView[]>;
}
