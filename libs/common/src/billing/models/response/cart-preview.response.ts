import {
  CartPreview,
  CartPreviewItem,
  Discount,
  PlanTier,
  PurchasableProration,
  PurchasableReference,
} from "@bitwarden/pricing";

import { BaseResponse } from "../../../models/response/base.response";
import { SubscriptionCadence, SubscriptionCadenceIds } from "../../types/subscription-pricing-tier";

const PlanTiers: readonly PlanTier[] = ["families", "teams", "enterprise", "premium"];

export class CartPreviewItemResponse extends BaseResponse implements CartPreviewItem {
  reference: PurchasableReference;
  quantity: number;
  cost: number;
  discounts?: Discount[];

  constructor(response: any) {
    super(response);

    // Deliberately not validated against the `PurchasableReference` union. A reference the client
    // does not recognize is a forward-compatibility case, not a parse failure: the translation
    // layer logs it and renders an empty label rather than failing the whole cart.
    this.reference = this.getResponseProperty("Reference");
    this.quantity = this.getResponseProperty("Quantity");
    this.cost = this.getResponseProperty("Cost");

    const discounts = this.getResponseProperty("Discounts");
    if (discounts) {
      this.discounts = discounts;
    }
  }
}

export class PurchasableProrationResponse extends BaseResponse implements PurchasableProration {
  credit: number;
  charge: number;
  tax: number;
  total: number;
  months: number;

  constructor(response: any) {
    super(response);

    this.credit = this.getResponseProperty("Credit");
    this.charge = this.getResponseProperty("Charge");
    this.tax = this.getResponseProperty("Tax");
    this.total = this.getResponseProperty("Total");
    this.months = this.getResponseProperty("Months");
  }
}

class PasswordManagerCartPreviewResponse extends BaseResponse {
  seats: CartPreviewItem;
  additionalStorage?: CartPreviewItem;
  prorations?: PurchasableProration[];

  constructor(response: any) {
    super(response);

    this.seats = new CartPreviewItemResponse(this.getResponseProperty("Seats"));

    const additionalStorage = this.getResponseProperty("AdditionalStorage");
    if (additionalStorage) {
      this.additionalStorage = new CartPreviewItemResponse(additionalStorage);
    }

    const prorations = this.getResponseProperty("Prorations");
    if (prorations) {
      this.prorations = prorations.map(
        (proration: any) => new PurchasableProrationResponse(proration),
      );
    }
  }
}

class SecretsManagerCartPreviewResponse extends BaseResponse {
  seats: CartPreviewItem;
  additionalServiceAccounts?: CartPreviewItem;
  prorations?: PurchasableProration[];

  constructor(response: any) {
    super(response);

    this.seats = new CartPreviewItemResponse(this.getResponseProperty("Seats"));

    const additionalServiceAccounts = this.getResponseProperty("AdditionalServiceAccounts");
    if (additionalServiceAccounts) {
      this.additionalServiceAccounts = new CartPreviewItemResponse(additionalServiceAccounts);
    }

    const prorations = this.getResponseProperty("Prorations");
    if (prorations) {
      this.prorations = prorations.map(
        (proration: any) => new PurchasableProrationResponse(proration),
      );
    }
  }
}

export class CartPreviewResponse extends BaseResponse implements CartPreview {
  passwordManager: {
    seats: CartPreviewItem;
    additionalStorage?: CartPreviewItem;
    prorations?: PurchasableProration[];
  };
  secretsManager?: {
    seats: CartPreviewItem;
    additionalServiceAccounts?: CartPreviewItem;
    prorations?: PurchasableProration[];
  };
  cadence: SubscriptionCadence;
  planTier: PlanTier;
  discounts?: Discount[];
  startingBalance?: number;
  estimatedTax: number;
  total: number;
  amountDue: number;
  nextPaymentAttempt?: Date;

  constructor(response: any) {
    super(response);

    this.passwordManager = new PasswordManagerCartPreviewResponse(
      this.getResponseProperty("PasswordManager"),
    );

    const secretsManager = this.getResponseProperty("SecretsManager");
    if (secretsManager) {
      this.secretsManager = new SecretsManagerCartPreviewResponse(secretsManager);
    }

    const cadence = this.getResponseProperty("Cadence");
    if (cadence !== SubscriptionCadenceIds.Annually && cadence !== SubscriptionCadenceIds.Monthly) {
      throw new Error(`Failed to parse invalid cadence: ${cadence}`);
    }
    this.cadence = cadence;

    const planTier = this.getResponseProperty("PlanTier");
    if (!PlanTiers.includes(planTier)) {
      throw new Error(`Failed to parse invalid plan tier: ${planTier}`);
    }
    this.planTier = planTier;

    const discounts = this.getResponseProperty("Discounts");
    if (discounts) {
      this.discounts = discounts;
    }

    const startingBalance = this.getResponseProperty("StartingBalance");
    if (startingBalance != null) {
      this.startingBalance = startingBalance;
    }

    this.estimatedTax = this.getResponseProperty("EstimatedTax");
    this.total = this.getResponseProperty("Total");
    this.amountDue = this.getResponseProperty("AmountDue");

    const nextPaymentAttempt = this.getResponseProperty("NextPaymentAttempt");
    if (nextPaymentAttempt) {
      this.nextPaymentAttempt = new Date(nextPaymentAttempt);
    }
  }
}
