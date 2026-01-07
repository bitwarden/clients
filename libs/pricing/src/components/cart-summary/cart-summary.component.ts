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

import { Cart } from "../../types/cart";
import { DiscountTypes, getLabel } from "../../types/discount";

/**
 * A reusable UI-only component that displays a cart summary with line items.
 * This component has no external dependencies and performs minimal logic -
 * it only displays data and allows expanding/collapsing of line items.
 */
@Component({
  selector: "billing-cart-summary",
  templateUrl: "./cart-summary.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TypographyModule, IconButtonModule, CurrencyPipe, I18nPipe, NgTemplateOutlet],
})
export class CartSummaryComponent {
  private i18nService = inject(I18nService);

  // Required inputs
  readonly cart = input.required<Cart>();

  // Optional inputs
  readonly header = input<TemplateRef<{ total: number }>>();

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
    const { secretsManager } = this.cart();
    if (!secretsManager) {
      return 0;
    }
    return secretsManager.seats.quantity * secretsManager.seats.cost;
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
   * Calculates the discount amount based on the cart discount
   */
  readonly discountAmount = computed<number>(() => {
    const { discount } = this.cart();
    if (!discount || !discount.active) {
      return 0;
    }

    const subtotal = this.subtotal();
    switch (discount.type) {
      case DiscountTypes.PercentOff: {
        const percentage = discount.value < 1 ? discount.value : discount.value / 100;
        return subtotal * percentage;
      }
      case DiscountTypes.AmountOff:
        return discount.value;
    }
  });

  /**
   * Gets the discount label for display
   */
  readonly discountLabel = computed<string>(() => {
    const { discount } = this.cart();
    if (!discount || !discount.active) {
      return "";
    }
    return getLabel(this.i18nService, discount);
  });

  /**
   * Calculates the total of all line items including discount and tax
   */
  readonly total = computed<number>(
    () => this.subtotal() - this.discountAmount() + this.estimatedTax(),
  );

  /**
   * Observable of computed total value
   */
  readonly total$ = toObservable(this.total);

  /**
   * Toggles the expanded/collapsed state of the cart items
   */
  toggleExpanded(): void {
    this.isExpanded.update((value: boolean) => !value);
  }
}
