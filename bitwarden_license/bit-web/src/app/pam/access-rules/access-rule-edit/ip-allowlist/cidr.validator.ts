import {
  AbstractControl,
  FormArray,
  FormControl,
  ValidationErrors,
  ValidatorFn,
} from "@angular/forms";

/**
 * Supplied by the caller rather than imported from the SDK, so this file runs without a booted
 * WASM module. The app passes {@link CidrValidationService}; tests and stories pass a stand-in.
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
