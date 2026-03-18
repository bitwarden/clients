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
import { getAmount, getLabel } from "../../types/discount";

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
  private readonly i18nService = inject(I18nService);

  // Required inputs
  readonly cart = input.required<Cart>();

  // Optional inputs
  readonly header = input<TemplateRef<{ total: number }>>();

  // Hide pricing term (e.g., "/ month" or "/ year") if true
  readonly hidePricingTerm = input<boolean>(false);

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
   * Calculates the discount amount for the Password Manager seats item.
   * Currently, only PM seats support item-level discounts (PM-33349).
   * If other cart items gain discount support, add corresponding signals and update total().
   */
  readonly passwordManagerSeatsDiscountAmount = computed<number>(() => {
    const {
      passwordManager: { seats },
    } = this.cart();
    return this.getItemDiscountAmount(seats);
  });

  /**
   * Gets the discount label for the Password Manager seats item
   */
  readonly passwordManagerSeatsDiscountLabel = computed<string>(() => {
    const {
      passwordManager: { seats },
    } = this.cart();
    if (!seats.discount) {
      return "";
    }
    return getLabel(this.i18nService, seats.discount);
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
   * Calculates the cart-level discount amount
   */
  readonly discountAmount = computed<number>(() => {
    const { discount } = this.cart();
    if (!discount) {
      return 0;
    }
    return getAmount(discount, this.subtotal());
  });

  /**
   * Gets the discount label for display
   */
  readonly discountLabel = computed<string>(() => {
    const { discount } = this.cart();
    if (!discount) {
      return "";
    }
    return getLabel(this.i18nService, discount);
  });

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
   * Calculates the total of all line items including discount and tax
   */
  readonly total = computed<number>(
    () =>
      this.subtotal() -
      this.discountAmount() -
      this.passwordManagerSeatsDiscountAmount() -
      this.creditAmount() +
      this.estimatedTax(),
  );

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

  private getItemDiscountAmount(item: CartItem): number {
    if (!item.discount) {
      return 0;
    }
    return getAmount(item.discount, item.quantity * item.cost);
  }
}
