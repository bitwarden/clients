/**
 * Button type for pricing card buttons
 */
export type ButtonType = "primary" | "secondary" | "danger" | "unstyled";

/**
 * Represents the pricing information for a pricing card
 */
export interface PricingCardPrice {
  /** The price amount */
  amount: number;
  /** The billing cadence */
  cadence: "annually" | "monthly";
}

/**
 * Represents the button configuration for a pricing card
 */
export interface PricingCardButton {
  /** The button text to display */
  text: string;
  /** The button type/style */
  type: ButtonType;
  /** Whether the button is disabled */
  disabled?: boolean;
}
