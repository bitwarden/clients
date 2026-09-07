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
 * The trimmed values that appear on more than one row. Empty rows are ignored.
 *
 * Single source of truth for "which ranges repeat": the array-level
 * {@link noDuplicateCidrsValidator} and the editor's row marks both derive from it, so they
 * can't disagree.
 */
export function duplicateCidrValues(values: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed === "") {
      continue;
    }
    if (seen.has(trimmed)) {
      duplicated.add(trimmed);
    }
    seen.add(trimmed);
  }
  return duplicated;
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
    const values = (control.controls as FormControl<string>[]).map((c) => c.value);
    return duplicateCidrValues(values).size > 0 ? { duplicateCidrs: true } : null;
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
