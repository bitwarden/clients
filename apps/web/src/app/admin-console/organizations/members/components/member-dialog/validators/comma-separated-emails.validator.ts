import { AbstractControl, ValidationErrors, Validators } from "@angular/forms";

function validateEmails(emails: string) {
  // Empty entries are tolerated so that a stray or trailing comma isn't treated as a typo,
  // but at least one email must remain once they're discarded.
  const entries = emails
    .split(",")
    .map((email) => email.trim())
    .filter((email) => email !== "");

  return (
    entries.length > 0 &&
    entries
      .map((email) => Validators.email(<AbstractControl>{ value: email }))
      .find((_) => _ !== null) === undefined
  );
}

export function commaSeparatedEmails(control: AbstractControl): ValidationErrors | null {
  if (control.value === "" || !control.value || validateEmails(control.value)) {
    return null;
  }
  return { multipleEmails: { message: "multipleInputEmails" } };
}
