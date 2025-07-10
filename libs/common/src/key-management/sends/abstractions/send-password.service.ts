import { SendHashedPassword } from "../types/send-hashed-password.type";

/**
 * Service for managing passwords for sends.
 */
export abstract class SendPasswordService {
  /**
   * Hashes a raw send password using the provided key material
   * @param password - the raw password to hash
   * @param keyMaterialUrlB64 - the key material as a url encoded base64 string
   * @returns a promise that resolves to the hashed password as a SendHashedPassword
   */
  abstract hashPassword(password: string, keyMaterialUrlB64: string): Promise<SendHashedPassword>;
}
