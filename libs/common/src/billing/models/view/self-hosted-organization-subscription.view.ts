// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { View } from "../../../models/view/view";
import { OrganizationSubscriptionResponse } from "../response/organization-subscription.response";

export class SelfHostedOrganizationSubscriptionView implements View {
  planName: string;

  /**
   * Date the subscription expires, including the grace period.
   */
  expirationWithGracePeriod?: Date;

  /**
   * Date the subscription expires, excluding the grace period.
   * This will be `null` for older (< v12) license files because they do not include this date.
   * In this case, you have to rely on the `expirationWithGracePeriod` instead.
   */
  expirationWithoutGracePeriod?: Date;

  constructor(response: OrganizationSubscriptionResponse) {
    if (response == null) {
      return;
    }

    this.planName = response.plan.name;
    this.expirationWithGracePeriod =
      response.expiration != null ? new Date(response.expiration) : null;
    this.expirationWithoutGracePeriod =
      response.expirationWithoutGracePeriod != null
        ? new Date(response.expirationWithoutGracePeriod)
        : null;
  }

  /**
   * The subscription has separate expiration dates for the subscription and the end of grace period.
   */
  get hasSeparateGracePeriod() {
    return this.expirationWithGracePeriod != null && this.expirationWithoutGracePeriod != null;
  }

  /**
   * True if the subscription has an expiration date.
   */
  get hasExpiration() {
    return this.expirationWithGracePeriod != null;
  }

  /**
   * True if the subscription has an expiration date that has past, but may still be within the grace period.
   * For older licenses (< v12), this will always be false because they do not include the `expirationWithoutGracePeriod`.
   */
  get isExpiredWithoutGracePeriod() {
    return this.hasSeparateGracePeriod && this.expirationWithoutGracePeriod < new Date();
  }

  /**
   * True if the subscription has an expiration date that has past, including the grace period.
   */
  get isExpiredAndOutsideGracePeriod() {
    return this.hasExpiration && this.expirationWithGracePeriod < new Date();
  }

  /**
   * In the case of a trial, where there is no grace period, the expirationWithGracePeriod and expirationWithoutGracePeriod will
   * be exactly the same. This can be used to hide the grace period note.
   */
  get isInTrial() {
    return (
      this.expirationWithGracePeriod &&
      this.expirationWithoutGracePeriod &&
      this.expirationWithGracePeriod.getTime() === this.expirationWithoutGracePeriod.getTime()
    );
  }
}
