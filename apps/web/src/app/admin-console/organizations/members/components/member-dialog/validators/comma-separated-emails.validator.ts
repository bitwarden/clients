import { AbstractControl, ValidationErrors, Validators } from "@angular/forms";

function validateEmails(emails: string) {
  return (
    emails
      .split(",")
      .map((email) => Validators.email(<AbstractControl>{ value: email.trim() }))
      .find((_) => _ !== null) === undefined
  );
}

export function commaSeparatedEmails(control: AbstractControl): ValidationErrors | null {
  if (control.value === "" || !control.value || validateEmails(control.value)) {
    return null;
  }
  return { multipleEmails: { message: "multipleInputEmails" } };
}
