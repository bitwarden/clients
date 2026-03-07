import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";

function getUniqueInputEmails(control: AbstractControl): string[] {
  const emails: string[] = control.value
    .split(",")
    .filter((email: string) => email && email.trim() !== "");
  const uniqueEmails: string[] = Array.from(new Set(emails));

  return uniqueEmails;
}

/**
 * Ensure the number of unique emails in an input does not exceed the allowed maximum.
 * @param maxEmailsCount The maximum number of emails allowed
 * @param getErrorMessage A callback function that generates the error message. It takes the `maxEmailsCount` as a parameter.
 * @returns A function that validates an `AbstractControl` and returns `ValidationErrors` or `null`
 */
export function inputEmailLimitValidator(
  maxEmailsCount: number,
  getErrorMessage: (maxEmailsCount: number) => string,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value?.trim()) {
      return null;
    }

    const uniqueEmails = getUniqueInputEmails(control);

    if (uniqueEmails.length <= maxEmailsCount) {
      return null;
    }

    return { tooManyEmails: { message: getErrorMessage(maxEmailsCount) } };
  };
}
