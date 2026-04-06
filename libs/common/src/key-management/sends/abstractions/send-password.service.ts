import { SendHashedPassword, SendPasswordKeyMaterial } from "../types/send-hashed-password.type";

/**
 * Service for managing passwords for sends.
 */
export abstract class SendPasswordService {
  /**
   * Hashes a raw send password using the provided key material
   * @param password - the raw password to hash
   * @param keyMaterial - the key material
   * @returns a promise that resolves to the hashed password as a SendHashedPassword
   */
  abstract hashPassword(
    password: string,
    keyMaterial: SendPasswordKeyMaterial,
  ): Promise<SendHashedPassword>;
}
