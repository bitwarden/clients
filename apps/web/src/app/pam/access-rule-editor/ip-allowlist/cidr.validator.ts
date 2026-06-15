import {
  AbstractControl,
  FormArray,
  FormControl,
  ValidationErrors,
  ValidatorFn,
} from "@angular/forms";

const IPV4_OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]\\d|\\d)";
const IPV4_CIDR_RE = new RegExp(
  `^${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}\\/(3[0-2]|[1-2]\\d|\\d)$`,
);

// Permissive IPv6 CIDR regex — accepts any sequence of hex groups / colons followed by a
// prefix length of 0–128.  Thoroughness is flagged as a TBD in PM-37273.
const IPV6_CIDR_RE = /^[0-9a-fA-F:]+(?::[0-9a-fA-F]*)?\/(12[0-8]|1[01]\d|[1-9]\d|\d)$/;

/** Returns `true` when `value` is a syntactically valid IPv4 or IPv6 CIDR range. */
export function isValidCidr(value: string): boolean {
  return IPV4_CIDR_RE.test(value) || IPV6_CIDR_RE.test(value);
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
