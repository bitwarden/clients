import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";

const SHA256_PREFIX = "SHA256:";

/**
 * Builds a validator for a single destination host-key fingerprint control.
 *
 * An empty value is valid — it represents a row the user hasn't finished filling in yet, and is
 * dropped by {@link normalizeSshAgentDestinationFingerprints} before persistence, not treated as
 * a real (empty) fingerprint.
 *
 * `errorMessage` is provided by the caller (typically `I18nService.t(...)`) rather than hard-coded
 * here, so this file — and the rest of `libs/vault` — never bakes in an English string. The
 * `{ message }` shape is what `BitErrorComponent`'s fallback rendering expects for error keys it
 * doesn't recognize natively, letting `bit-form-field` render the error automatically.
 */
export function sshAgentDestinationFingerprintValidator(errorMessage: string): ValidatorFn {
  return (control: AbstractControl<string | null>): ValidationErrors | null => {
    const value = (control.value ?? "").trim();
    if (value.length === 0) {
      return null;
    }

    return value.startsWith(SHA256_PREFIX)
      ? null
      : { invalidSshAgentDestinationFingerprint: { message: errorMessage } };
  };
}

/**
 * Normalizes raw destination host-key fingerprint form values before persistence:
 * trims whitespace, drops empty entries, and removes exact duplicates (first occurrence wins).
 *
 * Assumes every non-empty value has already passed {@link sshAgentDestinationFingerprintValidator}.
 */
export function normalizeSshAgentDestinationFingerprints(
  values: (string | null | undefined)[],
): string[] {
  const trimmed = values.map((value) => (value ?? "").trim()).filter((value) => value.length > 0);
  return Array.from(new Set(trimmed));
}
