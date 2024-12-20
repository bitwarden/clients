import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductTierType } from "@bitwarden/common/billing/enums";

function getUniqueInputEmails(control: AbstractControl): string[] {
  const emails: string[] = control.value
    .split(",")
    .filter((email: string) => email && email.trim() !== "");
  const uniqueEmails: string[] = Array.from(new Set(emails));

  return uniqueEmails;
}

/**
 * Ensure the number of unique emails in an input does not exceed the allowed maximum.
 * @param organization An object representing the organization
 * @param getErrorMessage A callback function that generates the error message. It takes the `maxEmailsCount` as a parameter.
 * @returns A function that validates an `AbstractControl` and returns `ValidationErrors` or `null`
 */
export function inputEmailLimitValidator(
  organization: Organization,
  getErrorMessage: (maxEmailsCount: number) => string,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value?.trim()) {
      return null;
    }

    const maxEmailsCount = organization.productTierType === ProductTierType.TeamsStarter ? 10 : 20;

    const uniqueEmails = getUniqueInputEmails(control);

    if (uniqueEmails.length <= maxEmailsCount) {
      return null;
    }

    return { tooManyEmails: { message: getErrorMessage(maxEmailsCount) } };
  };
}
