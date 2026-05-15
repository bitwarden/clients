import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { map } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  BadgeModule,
  BadgeVariant,
  ButtonModule,
  IconModule,
  IconTileComponent,
  TypographyModule,
} from "@bitwarden/components";
import { BitwardenSubscription, SubscriptionStatuses } from "@bitwarden/subscription";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccountBillingClient } from "../../clients";

type StatusBadge = { textKey: string; variant: BadgeVariant };

const MANAGE_PLAN_URL = "/settings/subscription/user-subscription";

@Component({
  templateUrl: "./premium-checkout-success.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeModule,
    ButtonModule,
    CommonModule,
    I18nPipe,
    IconModule,
    IconTileComponent,
    TypographyModule,
  ],
})
export class PremiumCheckoutSuccessComponent {
  private readonly accountBillingClient = inject(AccountBillingClient);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly logService = inject(LogService);
  private readonly router = inject(Router);

  protected readonly AuthenticationStatus = AuthenticationStatus;

  protected readonly authStatus = toSignal(this.authService.activeAccountStatus$, {
    initialValue: null,
  });

  // Stripe appends `session_id={CHECKOUT_SESSION_ID}` to the success redirect. We keep it
  // around so we can attach it to error logs — without it, a failed post-checkout load
  // can't be correlated with the Stripe session.
  private readonly checkoutSessionId = toSignal(
    this.activatedRoute.queryParamMap.pipe(map((params) => params.get("session_id"))),
    { initialValue: null },
  );

  protected readonly subscription = signal<BitwardenSubscription | null>(null);

  protected readonly planName = computed<string>(
    () => this.subscription()?.cart.passwordManager.seats.translationKey ?? "premium",
  );

  // The API doesn't return a subscription start date, so we render the date the user lands
  // on this page (immediately post-checkout) as a proxy. Replace with a server-supplied
  // field on `BitwardenSubscription` when one becomes available.
  protected readonly startDate = computed<Date | null>(() =>
    this.subscription() ? new Date() : null,
  );

  protected readonly renewalDate = computed<Date | null>(() => {
    const subscription = this.subscription();
    if (
      subscription &&
      (subscription.status === SubscriptionStatuses.Active ||
        subscription.status === SubscriptionStatuses.Trialing)
    ) {
      return subscription.nextCharge;
    }
    return null;
  });

  // This page renders immediately after Stripe Checkout, before the user has seen any
  // confirmation. Until they click through to the subscription management page (where
  // the live status is authoritative), we always show "Processing" — even if the API
  // already reports `active`, surfacing "Active" here would conflict with the rest of
  // the copy ("Your upgrade is being processed…").
  protected readonly statusBadge: StatusBadge = {
    textKey: "subscriptionStatusProcessing",
    variant: "info",
  };

  private readonly hasFetched = signal(false);

  // Hold the entire page behind one loading flag for authenticated users so the
  // subscription detail card doesn't pop in after the icon/heading. Logged-out
  // and locked users never trigger a fetch, so they skip the spinner entirely.
  private readonly _isLoading = signal(false);
  protected readonly isLoading = this._isLoading.asReadonly();

  constructor() {
    effect(() => {
      if (this.authStatus() !== AuthenticationStatus.Unlocked || this.hasFetched()) {
        return;
      }
      this.hasFetched.set(true);
      this._isLoading.set(true);
      void this.loadSubscription();
    });
  }

  private async loadSubscription(): Promise<void> {
    try {
      const result = await this.accountBillingClient.getSubscription();
      // Stripe's subscription webhook may not have settled when this page renders —
      // a stale `Canceled` response would render incorrect "subscription ended" UI,
      // so we degrade to the "Processing" badge + copy until the user refreshes.
      if (result?.status === SubscriptionStatuses.Canceled) {
        this.subscription.set(null);
        return;
      }
      this.subscription.set(result ?? null);
    } catch (error) {
      this.logService.error(
        "[PremiumCheckoutSuccess] Failed to load subscription after Stripe checkout",
        { sessionId: this.checkoutSessionId() },
        error,
      );
      this.subscription.set(null);
    } finally {
      this._isLoading.set(false);
    }
  }

  protected readonly managePlan = async (): Promise<void> => {
    await this.router.navigateByUrl(MANAGE_PLAN_URL);
  };
}
