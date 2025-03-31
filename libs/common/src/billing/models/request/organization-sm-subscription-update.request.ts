// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export class OrganizationSmSubscriptionUpdateRequest {
  /**
   * The number of seats to add or remove from the subscription.
   */
  seatAdjustment: number;

  /**
   * The maximum number of seats that can be auto-scaled for the subscription.
   */
  maxAutoscaleSeats?: number;

  /**
   * The number of additional service accounts to add or remove from the subscription.
   */
  serviceAccountAdjustment: number;

  /**
   * The maximum number of additional service accounts that can be auto-scaled for the subscription.
   */
  maxAutoscaleServiceAccounts?: number;
}
