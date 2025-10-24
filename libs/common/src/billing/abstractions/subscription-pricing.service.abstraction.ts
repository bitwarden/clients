import { Observable } from "rxjs";

import {
  BusinessSubscriptionPricingTier,
  PersonalSubscriptionPricingTier,
} from "../types/subscription-pricing-tier";

export abstract class SubscriptionPricingServiceAbstraction {
  /**
   * Gets personal subscription pricing tiers (Premium and Families).
   * Throws any errors that occur during api request so callers must handle errors.
   * @returns An observable of an array of personal subscription pricing tiers.
   * @throws Error if any errors occur during api request.
   */
  abstract getPersonalSubscriptionPricingTiers$(): Observable<PersonalSubscriptionPricingTier[]>;

  /**
   * Gets business subscription pricing tiers (Teams, Enterprise, and Custom).
   * Throws any errors that occur during api request so callers must handle errors.
   * @returns An observable of an array of business subscription pricing tiers.
   * @throws Error if any errors occur during api request.
   */
  abstract getBusinessSubscriptionPricingTiers$(): Observable<BusinessSubscriptionPricingTier[]>;

  /**
   * Gets developer subscription pricing tiers (Free, Teams, and Enterprise).
   * Throws any errors that occur during api request so callers must handle errors.
   * @returns An observable of an array of business subscription pricing tiers for developers.
   * @throws Error if any errors occur during api request.
   */
  abstract getDeveloperSubscriptionPricingTiers$(): Observable<BusinessSubscriptionPricingTier[]>;
}
