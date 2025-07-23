import { UserKey } from "@bitwarden/common/types/key";
import { EncryptionContext } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherListView } from "@bitwarden/sdk-internal";

import { UserId, OrganizationId } from "../../types/guid";
import { Cipher } from "../models/domain/cipher";
import { AttachmentView } from "../models/view/attachment.view";
import { CipherView } from "../models/view/cipher.view";

/**
 * Service responsible for encrypting and decrypting ciphers.
 */
export abstract class CipherEncryptionService {
  /**
   * Encrypts a cipher using the SDK for the given userId.
   * @param model The cipher view to encrypt
   * @param userId The user ID to initialize the SDK client with
   *
   * @returns A promise that resolves to the encryption context, or undefined if encryption fails
   */
  abstract encrypt(model: CipherView, userId: UserId): Promise<EncryptionContext | undefined>;

  /**
   * Move the cipher to the specified organization by re-encrypting its keys with the organization's key.
   * The cipher.organizationId will be updated to the new organizationId.
   * @param model The cipher view to move to the organization
   * @param organizationId The ID of the organization to move the cipher to
   * @param userId The user ID to initialize the SDK client with
   */
  abstract moveToOrganization(
    model: CipherView,
    organizationId: OrganizationId,
    userId: UserId,
  ): Promise<EncryptionContext | undefined>;

  /**
   * Encrypts cipher for a given userId with a new key for key rotation.
   * @param model The cipher view encrypt
   * @param userId The user ID to initialize the SDK client with
   * @param newKey The new key to use for re-encryption
   */
  abstract encryptCipherForRotation(
    model: CipherView,
    userId: UserId,
    newKey: UserKey,
  ): Promise<EncryptionContext | undefined>;

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
