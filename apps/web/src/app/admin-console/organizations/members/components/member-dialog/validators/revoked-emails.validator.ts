import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";

import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";

import { OrganizationUserView } from "../../../../core/views/organization-user.view";

/**
 * Checks if any of the entered emails belong to members in a revoked status
 * @param allOrganizationUsers An array of existing organization users
 * @param errorMessage A localized string to display if validation fails
 * @returns A function that validates an `AbstractControl` and returns `ValidationErrors` or `null`
 */
export function revokedEmailsValidator(
  allOrganizationUsers: OrganizationUserView[],
  errorMessage: string,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value?.trim()) {
      return null;
    }

    const inputEmails: string[] = control.value
      .split(",")
      .map((e: string) => e.trim())
      .filter(Boolean);

    const revokedEmails = allOrganizationUsers
      .filter((u) => u.status === OrganizationUserStatusType.Revoked)
      .map((u) => u.email.toLowerCase());

    const hasRevoked = inputEmails.some((email) => revokedEmails.includes(email.toLowerCase()));

    return hasRevoked ? { revokedEmails: { message: errorMessage } } : null;
  };
}
