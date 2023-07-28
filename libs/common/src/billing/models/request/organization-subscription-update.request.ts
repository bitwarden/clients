export class OrganizationSubscriptionUpdateRequest {
  /**
   * The number of seats to add or remove from the subscription.
   * Applies to both PM and SM request types.
   */
  seatAdjustment: number;

  /**
   * The maximum number of seats that can be auto-scaled for the subscription.
   * Applies to both PM and SM request types.
   */
  maxAutoscaleSeats?: number;

  /**
   * Build a subscription update request for the Password Manager product type.
   * @param seatAdjustment - The number of seats to add or remove from the subscription.
   * @param maxAutoscaleSeats - The maximum number of seats that can be auto-scaled for the subscription.
   */
  constructor(seatAdjustment: number, maxAutoscaleSeats?: number) {
    this.seatAdjustment = seatAdjustment;
    this.maxAutoscaleSeats = maxAutoscaleSeats;
  }
}
