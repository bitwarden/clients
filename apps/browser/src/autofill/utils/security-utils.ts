/**
 * Global configuration for autofill security checks in test environments.
 * This allows tests to disable security checks that interfere with synthetic events.
 */
interface AutofillSecurityConfig {
  /**
   * When true, disables isTrusted event validation for testing purposes.
   * Should only be set to true in Jest test environments.
   */
  disableEventTrustedValidation?: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var AUTOFILL_TEST_CONFIG: AutofillSecurityConfig | undefined;
}

/**
 * Checks if event trusted validation should be performed.
 * Returns false if validation is disabled in test environment.
 */
export function shouldValidateEventTrusted(): boolean {
  return !globalThis.AUTOFILL_TEST_CONFIG?.disableEventTrustedValidation;
}

/**
 * Validates that an event is trusted (not synthetically generated).
 * In test environments, this check can be disabled via AUTOFILL_TEST_CONFIG.
 *
 * @param event - The event to validate
 * @returns true if the event should be processed, false if it should be rejected
 */
export function isEventTrusted(event: Event): boolean {
  if (!shouldValidateEventTrusted()) {
    return true; // Allow all events when validation is disabled for testing
  }

  return event.isTrusted;
}
