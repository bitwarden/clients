export abstract class LoginDecryptionOptionsService {
  /**
   * Handles client-specific logic that runs after a user was successfully created
   */
  abstract handleCreateUserSuccess(): Promise<void | null>;
}
