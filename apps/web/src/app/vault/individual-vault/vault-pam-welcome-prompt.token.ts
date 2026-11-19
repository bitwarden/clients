import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * The one-time welcome a member sees on first reaching the vault after being granted PAM access.
 * `WebVaultPromptService` sequences it with the other onboarding interstitials.
 */
export interface PamWelcomePrompt {
  /** Whether this user is due the welcome on this visit. Never opens anything. */
  shouldPrompt(): Promise<boolean>;
  /**
   * Opens the welcome and resolves once it has closed. Records that the user has seen it however
   * they leave it, and starts the welcome tour only when they ask for it.
   */
  prompt(): Promise<void>;
}

/** Optional: unprovided, the vault shows no PAM welcome. */
export const VAULT_PAM_WELCOME_PROMPT = new SafeInjectionToken<PamWelcomePrompt>(
  "PamWelcomePrompt",
);
