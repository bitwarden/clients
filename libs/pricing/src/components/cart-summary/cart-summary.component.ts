import { CurrencyPipe, NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  TemplateRef,
} from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { IconButtonModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { Cart, CartItem } from "../../types/cart";
import { CartDiscount, getAmount, getLabel } from "../../types/discount";
import { DiscountBadgeComponent } from "../discount-badge/discount-badge.component";

/**
 * A reusable UI-only component that displays a cart summary with line items.
 * This component has no external dependencies and performs minimal logic -
 * it only displays data and allows expanding/collapsing of line items.
 */
@Component({
  selector: "billing-cart-summary",
  templateUrl: "./cart-summary.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TypographyModule,
    IconButtonModule,
    CurrencyPipe,
    I18nPipe,
    NgTemplateOutlet,
    DiscountBadgeComponent,
  ],
})
export class CartSummaryComponent {
  private readonly i18nService = inject(I18nService);

  // Required inputs
  readonly cart = input.required<Cart>();

  // Optional inputs
  readonly header = input<TemplateRef<{ total: number }>>();

  // Hide pricing term (e.g., "/ month" or "/ year") if true
  readonly hidePricingTerm = input<boolean>(false);

  // Show discount badge chips next to the header total; use in checkout flows only
  readonly showDiscountBadges = input<boolean>(false);

  // UI state
  readonly isExpanded = signal(true);

  /**
   * Calculates total for Password Manager seats
   */
  readonly passwordManagerSeatsTotal = computed<number>(() => {
    const {
      passwordManager: { seats },
    } = this.cart();
    return seats.quantity * seats.cost;
  });

  /**
   * Maps a line item's discounts to labeled rows.
   *
   * Each discount is applied against that line's extended price (quantity × cost). Unlike the
   * cart-wide discount loop, per-line discounts deliberately do NOT cascade against a running
   * subtotal — every entry is measured from the same base. Server-supplied amounts are
   * authoritative when present; otherwise the amount is derived from the discount type and value.
   *
   * The template tracks these rows by `$index`, not label: labels are not unique, because two
   * unlabeled discounts of the same type and value derive the identical display label.
   */
  private lineDiscountRows(item: CartItem | undefined): Array<{ label: string; amount: number }> {
    if (!item?.discounts?.length) {
      return [];
    }

    const extendedPrice = item.quantity * item.cost;
    return item.discounts.map((discount) => ({
      label: getLabel(this.i18nService, discount),
      amount: discount.amount ?? getAmount(discount, extendedPrice),
    }));
  }

  /**
   * Discount rows for the Password Manager seats line
   */
  readonly passwordManagerSeatsDiscountRows = computed(() =>
    this.lineDiscountRows(this.cart().passwordManager.seats),
  );

  /**
   * Discount rows for the additional storage line
   */
  readonly additionalStorageDiscountRows = computed(() =>
    this.lineDiscountRows(this.cart().passwordManager.additionalStorage),
  );

  /**
   * Discount rows for the Secrets Manager seats line
   */
  readonly secretsManagerSeatsDiscountRows = computed(() =>
    this.lineDiscountRows(this.cart().secretsManager?.seats),
  );

  /**
   * Discount rows for the additional service accounts line
   */
  readonly additionalServiceAccountsDiscountRows = computed(() =>
    this.lineDiscountRows(this.cart().secretsManager?.additionalServiceAccounts),
  );

  /**
   * Sums every per-line discount across all four line items
   */
  private readonly lineDiscountTotal = computed<number>(() =>
    [
      this.passwordManagerSeatsDiscountRows(),
      this.additionalStorageDiscountRows(),
      this.secretsManagerSeatsDiscountRows(),
      this.additionalServiceAccountsDiscountRows(),
    ]
      .flat()
      .reduce((sum, row) => sum + row.amount, 0),
  );

  /**
   * Calculates total for additional storage
   */
  readonly additionalStorageTotal = computed<number>(() => {
    const {
      passwordManager: { additionalStorage },
    } = this.cart();
    if (!additionalStorage) {
      return 0;
    }
    return additionalStorage.quantity * additionalStorage.cost;
  });

  /**
   * Calculates total for Secrets Manager seats
   */
  readonly secretsManagerSeatsTotal = computed<number>(() => {
    const seats = this.cart().secretsManager?.seats;
    if (!seats) {
      return 0;
    }
    return seats.quantity * seats.cost;
  });

  /**
   * Calculates total for secrets manager service accounts if present
   */
  readonly additionalServiceAccountsTotal = computed<number>(() => {
    const { secretsManager } = this.cart();
    if (!secretsManager || !secretsManager.additionalServiceAccounts) {
      return 0;
    }
    return (
      secretsManager.additionalServiceAccounts.quantity *
      secretsManager.additionalServiceAccounts.cost
    );
  });

  readonly estimatedTax = computed<number>(() => this.cart().estimatedTax);

  readonly term = computed<string>(() => {
    const { cadence } = this.cart();
    switch (cadence) {
      case "annually":
        return this.i18nService.t("year");
      case "monthly":
        return this.i18nService.t("month");
    }
  });

  /**
   * Calculates the subtotal before discount and tax
   */
  readonly subtotal = computed<number>(
    () =>
      this.passwordManagerSeatsTotal() +
      this.additionalStorageTotal() +
      this.secretsManagerSeatsTotal() +
      this.additionalServiceAccountsTotal(),
  );

  /**
   * Maps a list of discounts to labeled line items, applying each discount to the running
   * subtotal after the previous discount was subtracted. For example, two 10% discounts on
   * a $100 subtotal yield $10 off (subtotal → $90), then $9 off (subtotal → $81).
   */
  private calculateDiscountLineItems(
    discounts: CartDiscount[],
    subtotal: number,
  ): Array<{ label: string; amount: number }> {
    let runningSubtotal = subtotal;
    return discounts.map((discount) => {
      const amount = discount.amount ?? getAmount(discount, runningSubtotal);
      runningSubtotal -= amount;
      return { label: getLabel(this.i18nService, discount), amount };
    });
  }

  /**
   * Computes each discount as a labeled line item with its individual amount
   */
  readonly discountLineItems = computed<Array<{ label: string; amount: number }>>(() => {
    const { discounts } = this.cart();
    if (!discounts?.length) {
      return [];
    }
    return this.calculateDiscountLineItems(discounts, this.subtotal());
  });

  /**
   * Calculates the total discount amount across all discounts
   */
  readonly discountAmount = computed<number>(() =>
    this.discountLineItems().reduce((sum, item) => sum + item.amount, 0),
  );

  /**
   * Whether any cart-level discount row will render. The Subtotal row and the grouped
   * summary layout (subtotal → discounts → tax between dividers) appear only in this case;
   * without cart-level discounts the summary keeps its original per-row dividers.
   */
  readonly hasCartDiscounts = computed<boolean>(() =>
    this.discountLineItems().some((item) => item.amount > 0),
  );

  /**
   * Calculates the credit amount from the cart credit
   */
  readonly creditAmount = computed<number>(() => {
    const { credit } = this.cart();
    if (!credit) {
      return 0;
    }
    return credit.value;
  });

  /**
   * Calculates the total of all line items including discounts, credit and tax
   */
  private readonly computedTotal = computed<number>(
    () =>
      this.subtotal() -
      this.discountAmount() -
      this.lineDiscountTotal() -
      this.creditAmount() +
      this.estimatedTax(),
  );

  /**
   * The cart total, preferring the authoritative invoice total when the cart carries one.
   *
   * Uses `??` rather than `||` so an authoritative total of 0 (for example, a 100%-off
   * coupon) wins instead of falling back to the computed value.
   */
  readonly total = computed<number>(() => this.cart().total ?? this.computedTotal());

  /**
   * Observable of computed total value
   */
  readonly total$ = toObservable(this.total);

  /**
   * Translates a key with optional parameters
   */
  translateWithParams(key: string, params?: Array<string | number>): string {
    if (!params || params.length === 0) {
      return this.i18nService.t(key);
    }
    return this.i18nService.t(key, ...params);
  }

  /**
   * Toggles the expanded/collapsed state of the cart items
   */
  toggleExpanded(): void {
    this.isExpanded.update((value: boolean) => !value);
  }
}
