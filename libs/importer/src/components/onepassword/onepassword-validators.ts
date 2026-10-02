import { FormControl, ValidatorFn, Validators } from "@angular/forms";

/**
 * Reports an empty field with `message` in place of the generic "Input is required.". The control
 * keeps `Validators.required` after it, which marks the field as required, and the first error is
 * the one shown.
 */
export function requiredWithMessage(message: string): ValidatorFn {
  return (control) =>
    Validators.required(control) == null ? null : { requiredWithMessage: { message } };
}

/**
 * `Validators.email` against the trimmed value, since a padded paste is trimmed before it is used.
 * An empty value is left to the required check.
 */
export function trimmedEmailWithMessage(message: string): ValidatorFn {
  return (control) => {
    const value: unknown = control.value;
    return typeof value === "string" && Validators.email(new FormControl(value.trim())) != null
      ? { trimmedEmail: { message } }
      : null;
  };
}

/** A DNS label: letters, digits and inner dashes, at most 63 characters. */
const subdomainPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

/**
 * The SDK's own check of the sign-in address subdomain, after the same trim, so the form refuses
 * exactly what the SDK would before the user is asked for their Secret Key and password. An empty
 * value is left to the required check.
 */
export function subdomainWithMessage(message: string): ValidatorFn {
  return (control) => {
    const value: unknown = control.value;
    if (typeof value !== "string" || value.trim() === "") {
      return null;
    }
    return subdomainPattern.test(value.trim()) ? null : { subdomain: { message } };
  };
}
