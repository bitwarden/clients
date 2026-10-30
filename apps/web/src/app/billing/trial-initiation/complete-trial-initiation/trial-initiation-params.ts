import { Params } from "@angular/router";

import { ProductTierType, ProductType } from "@bitwarden/common/billing/enums";
import { DEFAULT_TRIAL_LENGTH_DAYS } from "@bitwarden/web-vault/app/billing/constants";

/** Products a trial link can request. */
const trialProducts: ProductType[] = [
  ProductType.PasswordManager,
  ProductType.SecretsManager,
  ProductType.PrivilegedControls,
];

/** Products that can be the trial's primary product; Privileged Controls is only ever an add-on. */
const baseProducts: ProductType[] = [ProductType.PasswordManager, ProductType.SecretsManager];

export interface TrialInitiationParams {
  /** Trial account email, when the link carries a valid address. */
  email?: string;
  /** The user arrived from a verification email. */
  emailVerified: boolean;
  /** Token proving the email was verified. */
  emailVerificationToken?: string;
  /** Set when a sales rep created the trial from the Admin Portal. */
  salesAssistedToken?: string;
  /** The trial's primary product (Password Manager or Secrets Manager). */
  product: ProductType;
  /** The link requested Privileged Controls as an add-on. */
  privilegedControlsRequested: boolean;
  /** Plan tier being trialed, when the link carries a valid one. */
  productTier?: ProductTierType;
  /** Trial length in days; 0 means a direct purchase rather than a trial. */
  trialLength: number;
  /** Whether the trial can start without a payment method. */
  paymentOptional: boolean;
  /** Set for a Families-for-Enterprise sponsorship link. */
  sponsorshipToken?: string;
}

/**
 * Parses a trial link's query parameters into a {@link TrialInitiationParams} model.
 *
 * `product` is a comma-separated list of ints (e.g. `"0,2"` for Password Manager + Privileged
 * Controls); unrecognized values are dropped. The set is split into a primary `product` (the first
 * base product listed) and the `privilegedControlsRequested` add-on flag.
 */
export function parseTrialInitiationParams(queryParams: Params): TrialInitiationParams {
  const products = String(queryParams.product ?? "")
    .split(",")
    .map((value) => parseInt(value))
    .filter((value) => trialProducts.includes(value));

  const email = isValidEmail(queryParams.email) ? queryParams.email : undefined;

  return {
    email,
    emailVerified: queryParams.fromEmail === "true",
    emailVerificationToken: queryParams.token ?? undefined,
    salesAssistedToken: queryParams.salesAssistedToken ?? undefined,
    product: baseProduct(products),
    privilegedControlsRequested: products.includes(ProductType.PrivilegedControls),
    productTier: toOptionalInt(queryParams.productTier) as ProductTierType | undefined,
    trialLength: toOptionalInt(queryParams.trialLength) ?? DEFAULT_TRIAL_LENGTH_DAYS,
    paymentOptional: queryParams.paymentOptional === "true",
    sponsorshipToken: queryParams.sponsorshipToken ?? undefined,
  };
}

/**
 * The trial's primary product — the first base product (Password Manager or Secrets Manager)
 * A link shouldn't list both base products; if one does, the first listed wins.
 * Defaults to Password Manager when neither is present.
 */
function baseProduct(products: ProductType[]): ProductType {
  return products.find((value) => baseProducts.includes(value)) ?? ProductType.PasswordManager;
}

function toOptionalInt(value: unknown): number | undefined {
  const parsed = parseInt(value as string);
  return isNaN(parsed) ? undefined : parsed;
}

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && value.includes("@");
}
