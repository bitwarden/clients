import { CurrencyPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { IconButtonModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { Discount, getDiscountText } from "../../types/discount";

export type LineItem = {
  quantity: number;
  name: string;
  cost: number;
  cadence: "month" | "year";
};

/**
 * A reusable UI-only component that displays a cart summary with line items.
 * This component has no external dependencies and performs minimal logic -
 * it only displays data and allows expanding/collapsing of line items.
 */
@Component({
  selector: "billing-cart-summary",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./cart-summary.component.html",
  imports: [TypographyModule, IconButtonModule, CurrencyPipe, I18nPipe],
})
export class CartSummaryComponent {
  // Required inputs
  readonly passwordManager = input.required<LineItem>();
  readonly additionalStorage = input<LineItem>();
  readonly secretsManager = input<{ seats: LineItem; additionalServiceAccounts?: LineItem }>();
  readonly discount = input<Discount>();
  readonly estimatedTax = input.required<number>();

  // UI state
  readonly isExpanded = signal(true);

  private i18nService = inject(I18nService);

  /**
   * Calculates total for password manager line item
   */
  readonly passwordManagerTotal = computed<number>(() => {
    return this.passwordManager().quantity * this.passwordManager().cost;
  });

  /**
   * Calculates total for additional storage line item if present
   */
  readonly additionalStorageTotal = computed<number>(() => {
    const storage = this.additionalStorage();
    return storage ? storage.quantity * storage.cost : 0;
  });

  /**
   * Calculates total for secrets manager seats if present
   */
  readonly secretsManagerSeatsTotal = computed<number>(() => {
    const sm = this.secretsManager();
    return sm?.seats ? sm.seats.quantity * sm.seats.cost : 0;
  });

  /**
   * Calculates total for secrets manager service accounts if present
   */
  readonly additionalServiceAccountsTotal = computed<number>(() => {
    const sm = this.secretsManager();
    return sm?.additionalServiceAccounts
      ? sm.additionalServiceAccounts.quantity * sm.additionalServiceAccounts.cost
      : 0;
  });

  /**
   * Calculates subtotal before discount
   */
  readonly subtotal = computed<number>(() => {
    return (
      this.passwordManagerTotal() +
      this.additionalStorageTotal() +
      this.secretsManagerSeatsTotal() +
      this.additionalServiceAccountsTotal()
    );
  });

  readonly appliedDiscount = computed<{ text: string; value: number } | null>(() => {
    const discount = this.discount();
    if (!discount || !discount.active || discount.value <= 0) {
      return null;
    }
    const text = getDiscountText(this.i18nService, discount);
    switch (discount._tag) {
      case "amount-off":
        return { text, value: discount.value };
      case "percent-off": {
        const percentValue = discount.value < 1 ? discount.value : discount.value / 100;
        return {
          text,
          value: this.subtotal() * percentValue,
        };
      }
    }
  });

  /**
   * Calculates the total of all line items
   */
  readonly total = computed<number>(() => {
    const appliedDiscount = this.appliedDiscount();
    return appliedDiscount
      ? this.subtotal() - appliedDiscount.value + this.estimatedTax()
      : this.subtotal() + this.estimatedTax();
  });

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
