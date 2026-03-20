import { Injectable } from "@angular/core";
import { from, map, merge, Observable, of, shareReplay, Subject, switchMap } from "rxjs";

import { DiscountTierType } from "@bitwarden/common/billing/enums";
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

  private cachedDiscounts$: Observable<SubscriptionDiscount[]> | undefined;

  refresh(): void {
    this.refreshTrigger.next();
  }

  getEligibleDiscounts$(): Observable<SubscriptionDiscount[]> {
    const featureFlag$ = this.configService
      .getFeatureFlag$(FeatureFlag.PM29108_EnablePersonalDiscounts)
      .pipe(shareReplay({ refCount: true, bufferSize: 1 }));

    return featureFlag$.pipe(
      switchMap((featureFlagEnabled) => {
        if (!featureFlagEnabled) {
          return of([]);
        }

        return merge(
          this.fetchDiscounts$(),
          this.refreshTrigger.pipe(switchMap(() => this.fetchDiscounts$(true))),
        ).pipe(shareReplay({ refCount: true, bufferSize: 1 }));
      }),
    );
  }

  getEligibleDiscountsForTier$ = (tier: DiscountTierType): Observable<SubscriptionDiscount[]> =>
    this.getEligibleDiscounts$().pipe(
      map((discounts) => {
        return discounts.filter((d) => d.tierEligibility[tier]);
      }),
    );

  isDiscountExpiredError(error: unknown): boolean {
    return (
      error instanceof ErrorResponse &&
      error.statusCode === 400 &&
      error.message === DISCOUNT_EXPIRED_MESSAGE
    );
  }

  mapToCartDiscount(discount: SubscriptionDiscount): Discount | null {
    if (discount.percentOff != null) {
      return { type: DiscountTypes.PercentOff, value: discount.percentOff };
    }
    if (discount.amountOff != null) {
      return { type: DiscountTypes.AmountOff, value: discount.amountOff / 100 };
    }
    return null;
  }

  private fetchDiscounts$(skipCache: boolean = false): Observable<SubscriptionDiscount[]> {
    if (skipCache || !this.cachedDiscounts$) {
      this.cachedDiscounts$ = from(this.accountBillingClient.getApplicableDiscounts());
    }
    return this.cachedDiscounts$;
  }
}
