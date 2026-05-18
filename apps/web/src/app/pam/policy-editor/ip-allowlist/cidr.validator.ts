import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";

const IPV4_OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]\\d|\\d)";
const IPV4_CIDR_RE = new RegExp(
  `^${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}\\/(3[0-2]|[1-2]\\d|\\d)$`,
);

// Permissive IPv6 CIDR regex — accepts any sequence of hex groups / colons followed by a
// prefix length of 0–128.  Thoroughness is flagged as a TBD in PM-37273.
const IPV6_CIDR_RE =
  /^[0-9a-fA-F:]+(?::[0-9a-fA-F]*)?\/(12[0-8]|1[01]\d|[1-9]\d|\d)$/;

/** Returns `true` when `value` is a syntactically valid IPv4 or IPv6 CIDR range. */
export function isValidCidr(value: string): boolean {
  return IPV4_CIDR_RE.test(value) || IPV6_CIDR_RE.test(value);
}

/**
 * Angular validator that rejects a control whose value is not a valid CIDR.
 * Attach to individual row controls.
 */
export function cidrValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string = (control.value ?? "").trim();
    if (value === "") {
      return null;
    }
    return isValidCidr(value) ? null : { invalidCidr: true };
  };
}
