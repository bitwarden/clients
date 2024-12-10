import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductTierType } from "@bitwarden/common/billing/enums";

/**
 * If the organization doesn't allow additional seat options, this checks if the seat limit has been reached when adding
 * new users
 * @param organization An object representing the organization
 * @param allOrganizationUserEmails An array of strings with existing user email addresses
 * @param errorMessage A localized string to display if validation fails
 * @returns A function that validates an `AbstractControl` and returns `ValidationErrors` or `null`
 */
export function orgSeatLimitReachedValidator(
  organization: Organization,
  allOrganizationUserEmails: string[],
  errorMessage: string,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (control.value === "" || !control.value) {
      return null;
    }

    const newEmailsToAdd = Array.from(
      new Set(
        control.value
          .split(",")
          .filter(
            (newEmailToAdd: string) =>
              newEmailToAdd &&
              newEmailToAdd.trim() !== "" &&
              !allOrganizationUserEmails.some(
                (existingEmail) => existingEmail === newEmailToAdd.trim(),
              ),
          ),
      ),
    );

    const productHasAdditionalSeatsOption =
      organization.productTierType !== ProductTierType.Free &&
      organization.productTierType !== ProductTierType.Families &&
      organization.productTierType !== ProductTierType.TeamsStarter;

    return !productHasAdditionalSeatsOption &&
      allOrganizationUserEmails.length + newEmailsToAdd.length > organization.seats
      ? { seatLimitReached: { message: errorMessage } }
      : null;
  };
}

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
    if (control.value === "" || !control.value) {
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
