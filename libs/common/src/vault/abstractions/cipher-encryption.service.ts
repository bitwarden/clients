import { CipherListView } from "@bitwarden/sdk-internal";

import { UserId } from "../../types/guid";
import { Cipher } from "../models/domain/cipher";
import { AttachmentView } from "../models/view/attachment.view";
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
   * Decrypts many ciphers using the SDK for the given userId.
   *
   * For bulk decryption, prefer using `decryptMany`, which returns a more efficient
   * `CipherListView` object.
   *
   * @param ciphers The encrypted cipher objects
   * @param userId The user ID whose key will be used for decryption
   *
   * @deprecated Use `decryptMany` for bulk decryption instead.
   *
   * @returns A promise that resolves to an array of decrypted cipher views
   */
  abstract decryptManyLegacy(ciphers: Cipher[], userId: UserId): Promise<CipherView[]>;
  /**
   * Decrypts many ciphers using the SDK for the given userId.
   *
   * @param ciphers The encrypted cipher objects
   * @param userId The user ID whose key will be used for decryption
   *
   * @returns A promise that resolves to an array of decrypted cipher list views
   */
  abstract decryptMany(ciphers: Cipher[], userId: UserId): Promise<CipherListView[]>;
  /**
   * Decrypts an attachment's content from a response object.
   *
   * @param cipher The encrypted cipher object that owns the attachment
   * @param attachment The attachment view object
   * @param encryptedContent The encrypted content of the attachment
   * @param userId The user ID whose key will be used for decryption
   *
   * @returns A promise that resolves to the decrypted content
   */
  abstract decryptAttachmentContent(
    cipher: Cipher,
    attachment: AttachmentView,
    encryptedContent: Uint8Array,
    userId: UserId,
  ): Promise<Uint8Array>;
}
