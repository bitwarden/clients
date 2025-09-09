import { CurrencyPipe } from "@angular/common";
import { Component, computed, input, signal } from "@angular/core";

import { TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

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
  templateUrl: "./cart-summary.component.html",
  imports: [TypographyModule, CurrencyPipe, I18nPipe],
})
export class CartSummaryComponent {
  // Required inputs
  passwordManager = input.required<LineItem>();
  additionalStorage = input<LineItem>();
  secretsManager = input<{ seats: LineItem; additionalServiceAccounts?: LineItem }>();
  estimatedTax = input.required<number>();

  // UI state
  isExpanded = signal(true);

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
   * Calculates the total of all line items
   */
  readonly total = computed<number>(() => this.getTotalCost());

  /**
   * Toggles the expanded/collapsed state of the cart items
   */
  toggleExpanded(): void {
    this.isExpanded.update((value: boolean) => !value);
  }

  /**
   * Gets the total cost of all line items in the cart
   * @returns The total cost as a number
   */
  private getTotalCost(): number {
    return (
      this.passwordManagerTotal() +
      this.additionalStorageTotal() +
      this.secretsManagerSeatsTotal() +
      this.additionalServiceAccountsTotal() +
      this.estimatedTax()
    );
  }
}
