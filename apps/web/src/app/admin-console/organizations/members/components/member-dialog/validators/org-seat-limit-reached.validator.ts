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
