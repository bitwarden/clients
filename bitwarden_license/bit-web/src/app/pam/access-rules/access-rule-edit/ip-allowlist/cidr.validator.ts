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

/** For individual row controls; a blank row passes. */
export function cidrValidator(invalidMessage: string, isValid: CidrPredicate): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string = (control.value ?? "").trim();
    if (value === "") {
      return null;
    }
    return isValid(value) ? null : { invalidCidr: { message: invalidMessage } };
  };
}

/** Shared by {@link noDuplicateCidrsValidator} and the editor's row marks, so they agree. */
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
