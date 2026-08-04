import {
  AbstractControl,
  FormArray,
  FormControl,
  ValidationErrors,
  ValidatorFn,
} from "@angular/forms";

/**
 * Predicate that reports whether a string is a valid IPv4 or IPv6 CIDR range.
 *
 * CIDR parsing lives in the Rust SDK (`is_valid_cidr`, backed by the `ipnet` crate), which is
 * only available once the WASM module is loaded at app startup. Rather than importing that free
 * function here — which would pull the WASM-backed SDK into every consumer's module graph and
 * make this file impossible to exercise outside a booted app (Storybook, isolated unit tests) —
 * the check is supplied by the caller. The app wires the real implementation via
 * {@link CidrValidationService}; tests and stories pass a lightweight stand-in.
 */
export type CidrPredicate = (value: string) => boolean;

/**
 * Angular validator that rejects a control whose value is not a valid CIDR. Attach to individual
 * row controls. `isValid` supplies the CIDR check (see {@link CidrPredicate}).
 */
export function cidrValidator(invalidMessage: string, isValid: CidrPredicate): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string = (control.value ?? "").trim();
    if (value === "") {
      return null;
    }
    return isValid(value) ? null : { invalidCidr: { message: invalidMessage } };
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
