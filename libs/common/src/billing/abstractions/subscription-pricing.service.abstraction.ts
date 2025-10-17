import { Observable } from "rxjs";

import {
  BusinessSubscriptionPricingTier,
  PersonalSubscriptionPricingTier,
} from "../types/subscription-pricing-tier";

export abstract class SubscriptionPricingServiceAbstraction {
  /**
   * Gets personal subscription pricing tiers (Premium and Families).
   * @returns An observable of an array of personal subscription pricing tiers.
   */
  abstract getPersonalSubscriptionPricingTiers$(): Observable<PersonalSubscriptionPricingTier[]>;

  /**
   * Gets business subscription pricing tiers (Teams, Enterprise, and Custom).
   * @returns An observable of an array of business subscription pricing tiers.
   */
  abstract getBusinessSubscriptionPricingTiers$(): Observable<BusinessSubscriptionPricingTier[]>;

  /**
   * Gets developer subscription pricing tiers (Free, Teams, and Enterprise).
   * @returns An observable of an array of business subscription pricing tiers for developers.
   */
  abstract getDeveloperSubscriptionPricingTiers$(): Observable<BusinessSubscriptionPricingTier[]>;
}
