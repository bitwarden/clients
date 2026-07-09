import {
  AbstractControl,
  FormArray,
  FormControl,
  ValidationErrors,
  ValidatorFn,
} from "@angular/forms";

import { is_valid_cidr } from "@bitwarden/sdk-internal";

/**
 * Returns `true` when `value` is a valid IPv4 or IPv6 CIDR range.
 *
 * Delegates to the Rust SDK (`is_valid_cidr`, backed by the `ipnet` crate) instead of the
 * previous regex pair. The WASM module is loaded at app startup via `SdkLoadService`, so the
 * free function is synchronously available here — see other direct SDK free-function call
 * sites (e.g. `import_ssh_key` in `onepassword-1pux-importer.ts`) for the same convention.
 *
 * Behavior differences vs. the former regexes (see PM-37273):
 * - Host bits set past the prefix are now rejected, e.g. `10.0.0.1/8` is now **invalid**
 *   (the old strict IPv4 regex accepted it — it only validated octet/prefix shape, not that
 *   the address was the network address for that prefix).
 * - The prefix is required and must be explicit; the SDK parser has no bare-address fallback.
 * - IPv6 is now fully parsed (real address validation, e.g. rejecting too many hex groups or
 *   multiple `::` compressions) rather than matched against the old permissive
 *   hex-and-colon regex, which accepted many strings that were not valid IPv6 addresses.
 */
export function isValidCidr(value: string): boolean {
  return is_valid_cidr(value);
}

/**
 * Angular validator that rejects a control whose value is not a valid CIDR.
 * Attach to individual row controls.
 */
export function cidrValidator(invalidMessage: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string = (control.value ?? "").trim();
    if (value === "") {
      return null;
    }
    return isValidCidr(value) ? null : { invalidCidr: { message: invalidMessage } };
  };
}

/**
 * Cross-array validator: rejects with `{ duplicateCidrs: true }` if any two
 * row controls share the same trimmed value. Empty rows are ignored. Attach to
 * the CIDR {@link FormArray}.
 */
export function noDuplicateCidrsValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!(control instanceof FormArray)) {
      return null;
    }
    const values = (control.controls as FormControl<string>[]).map((c) => c.value.trim());
    const seen = new Set<string>();
    for (const v of values) {
      if (v === "") {
        continue;
      }
      if (seen.has(v)) {
        return { duplicateCidrs: true };
      }
      seen.add(v);
    }
    return null;
  };
}

/**
 * Array-level validator: rejects with `{ atLeastOneCidr: true }` when no row
 * has a non-empty CIDR value. Attach to the CIDR {@link FormArray}.
 */
export function atLeastOneNonEmptyCidrValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!(control instanceof FormArray)) {
      return null;
    }
    const hasNonEmpty = (control.controls as FormControl<string>[]).some(
      (c) => c.value.trim() !== "",
    );
    return hasNonEmpty ? null : { atLeastOneCidr: true };
  };
}
