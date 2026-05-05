import { Injectable } from "@angular/core";
import { from, map, merge, Observable, of, shareReplay, Subject, switchMap } from "rxjs";

import { DiscountTierType } from "@bitwarden/common/billing/enums";
import { SubscriptionDiscountEligibility } from "@bitwarden/common/billing/models/response/subscription-discount-eligibility.response";
import { SubscriptionDiscount } from "@bitwarden/common/billing/models/response/subscription-discount.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Discount, DiscountTypes } from "@bitwarden/pricing";

import { AccountBillingClient } from "../clients/account-billing.client";

const DISCOUNT_EXPIRED_MESSAGE = "Discount expired. Please review your cart total and try again";

@Injectable({ providedIn: "root" })
export class SubscriptionDiscountService {
  private readonly refreshTrigger = new Subject<void>();

  constructor(
    private accountBillingClient: AccountBillingClient,
    private configService: ConfigService,
  ) {}

  private subscriptionDiscountEligibility$: Observable<SubscriptionDiscountEligibility> | undefined;

  refresh(): void {
    this.refreshTrigger.next();
  }

  getCartLevelDiscountsForTier$(tier: DiscountTierType): Observable<Discount[]> {
    return this.getSubscriptionDiscountEligibility$().pipe(
      map(({ cartLevelDiscounts }) =>
        cartLevelDiscounts
          .filter((d) => d.tierEligibility[tier])
          .map((d) => this.mapToCartDiscount(d))
          .filter((d): d is Discount => d !== null),
      ),
    );
  }

  getItemLevelDiscountsForTier$(tier: DiscountTierType): Observable<Discount[]> {
    return this.getSubscriptionDiscountEligibility$().pipe(
      map(({ itemLevelDiscounts }) =>
        itemLevelDiscounts
          .filter((d) => d.tierEligibility[tier])
          .map((d) => this.mapToCartDiscount(d))
          .filter((d): d is Discount => d !== null),
      ),
    );
  }

  getAllEligibleSubscriptionDiscountsForTier$(
    tier: DiscountTierType,
  ): Observable<SubscriptionDiscount[]> {
    return this.getSubscriptionDiscountEligibility$().pipe(
      map(({ cartLevelDiscounts, itemLevelDiscounts }) =>
        [...cartLevelDiscounts, ...itemLevelDiscounts].filter((d) => d.tierEligibility[tier]),
      ),
    );
  }

  isDiscountExpiredError(error: unknown): boolean {
    return (
      error instanceof ErrorResponse &&
      error.statusCode === 400 &&
      error.message === DISCOUNT_EXPIRED_MESSAGE
    );
  }

  private mapToCartDiscount(discount: SubscriptionDiscount): Discount | null {
    if (discount.percentOff != null) {
      return { type: DiscountTypes.PercentOff, value: discount.percentOff };
    }
    if (discount.amountOff != null) {
      return { type: DiscountTypes.AmountOff, value: discount.amountOff / 100 };
    }
    return null;
  }

  private getSubscriptionDiscountEligibility$(): Observable<SubscriptionDiscountEligibility> {
    this.subscriptionDiscountEligibility$ ??= this.configService
      .getFeatureFlag$(FeatureFlag.PM29108_EnablePersonalDiscounts)
      .pipe(
        switchMap((featureFlagEnabled): Observable<SubscriptionDiscountEligibility> => {
          if (!featureFlagEnabled) {
            return of({ cartLevelDiscounts: [], itemLevelDiscounts: [] });
          }
          return merge(
            this.fetchDiscounts$(),
            this.refreshTrigger.pipe(switchMap(() => this.fetchDiscounts$())),
          );
        }),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
    return this.subscriptionDiscountEligibility$;
  }

  private fetchDiscounts$(): Observable<SubscriptionDiscountEligibility> {
    return from(this.accountBillingClient.getApplicableDiscounts());
  }
}
