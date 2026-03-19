/**
 * Service responsible for generating random passwords for Send forms.
 * Platform-specific implementations can override this to provide
 * different UI experiences (e.g., modal dialog vs. navigation-based).
 */
export abstract class SendFormGenerationService {
  /**
   * Generates a random password. Called when the user clicks the "Generate Password" button in the Send form.
   * @returns The generated password, or null if the user canceled.
   */
  abstract generatePassword(): Promise<string | null>;
}
