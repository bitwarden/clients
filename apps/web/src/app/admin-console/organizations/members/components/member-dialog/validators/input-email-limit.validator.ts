import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductTierType } from "@bitwarden/common/billing/enums";

export function isDynamicSeatPlan(productTierType: ProductTierType): boolean {
  return !isFixedSeatPlan(productTierType);
}

export function isFixedSeatPlan(productTierType: ProductTierType): boolean {
  switch (productTierType) {
    case ProductTierType.Free:
    case ProductTierType.Families:
    case ProductTierType.TeamsStarter:
      return true;
    default:
      return false;
  }
}

/**
 * Returns the maximum number of unique emails an admin may submit in a single invite operation.
 *
 * @remarks Business rules:
 * - Dynamic-seat plans (Teams, Enterprise, etc.) can auto-purchase seats on demand, so remaining
 *   seat count is irrelevant. These plans always allow up to 20 emails per batch.
 * - Fixed-seat plans (Free, Families, TeamsStarter) have a hard seat cap encoded in
 *   `organization.seats`, so the limit is clamped to however many seats are still available.
 *   No per-plan overrides are needed here — the remaining-seats calculation handles every fixed
 *   plan automatically (e.g. a TeamsStarter org already has `organization.seats = 10`).
 * - For any fixed-seat plan the limit floors at 0 when the org is already oversubscribed
 *   (occupiedSeatCount > seats). `inputEmailLimitValidator` uses this value directly; passing
 *   `existingEmails` ensures that re-inviting an already-accepted member is still permitted
 *   (no new seat is consumed) even when the org is at full capacity.
 */
export function getEmailBatchLimit(organization: Organization, occupiedSeatCount: number): number {
  // Arbitrary limit on the number of email addresses the invite input accepts in a single submission.
  const batchLimit = 20;

  if (isDynamicSeatPlan(organization.productTierType)) {
    return batchLimit;
  }

  const remainingSeats = organization.seats - occupiedSeatCount;
  return Math.min(batchLimit, Math.max(0, remainingSeats));
}

function getUniqueInputEmails(control: AbstractControl, existingEmails: string[] = []): string[] {
  const emails: string[] = control.value
    .split(",")
    .map((email: string) => email.trim())
    .filter((email: string) => email !== "");
  const uniqueEmails: string[] = Array.from(new Set(emails));

  if (existingEmails.length === 0) {
    return uniqueEmails;
  }

  const existingEmailsSet = new Set(existingEmails);
  return uniqueEmails.filter((email) => !existingEmailsSet.has(email));
}

/**
 * Ensure the number of unique emails in an input does not exceed the allowed maximum.
 * @param maxEmailsCount The maximum number of emails allowed
 * @param getErrorMessage A callback function that generates the error message. It takes the `maxEmailsCount` as a parameter.
 * @param existingEmails Optional list of already-member email addresses to exclude from the count.
 *   Emails belonging to existing members do not consume additional seats, so they should not
 *   count toward the batch limit.
 * @returns A function that validates an `AbstractControl` and returns `ValidationErrors` or `null`
 */
export function inputEmailLimitValidator(
  maxEmailsCount: number,
  getErrorMessage: (maxEmailsCount: number) => string,
  existingEmails: string[] = [],
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value?.trim()) {
      return null;
    }

    const uniqueNewEmails = getUniqueInputEmails(control, existingEmails);

    if (uniqueNewEmails.length <= maxEmailsCount) {
      return null;
    }

    return { tooManyEmails: { message: getErrorMessage(maxEmailsCount) } };
  };
}
