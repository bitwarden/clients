import {
  InvoicePreview,
  InvoicePreviewDiscount,
  InvoicePreviewItem,
  PlanTier,
  PurchasableProration,
  PurchasableReference,
} from "@bitwarden/pricing";

import { BaseResponse } from "../../../models/response/base.response";
import { SubscriptionCadence, SubscriptionCadenceIds } from "../../types/subscription-pricing-tier";

import { InvoicePreviewDiscountResponse } from "./invoice-preview-discount.response";

const PlanTiers: readonly PlanTier[] = ["families", "teams", "enterprise", "premium"];

export class InvoicePreviewItemResponse extends BaseResponse implements InvoicePreviewItem {
  reference: PurchasableReference;
  quantity: number;
  cost: number;
  discounts?: InvoicePreviewDiscount[];

  constructor(response: any) {
    super(response);

    this.reference = this.getResponseProperty("Reference");
    this.quantity = this.getResponseProperty("Quantity");
    this.cost = this.getResponseProperty("Cost");

    const discounts = this.getResponseProperty("Discounts");
    if (discounts) {
      this.discounts = discounts.map(
        (discount: any) => new InvoicePreviewDiscountResponse(discount),
      );
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

class PasswordManagerInvoicePreviewResponse extends BaseResponse {
  seats: InvoicePreviewItem;
  additionalStorage?: InvoicePreviewItem;
  prorations?: PurchasableProration[];

  constructor(response: any) {
    super(response);

    this.seats = new InvoicePreviewItemResponse(this.getResponseProperty("Seats"));

    const additionalStorage = this.getResponseProperty("AdditionalStorage");
    if (additionalStorage) {
      this.additionalStorage = new InvoicePreviewItemResponse(additionalStorage);
    }

    const prorations = this.getResponseProperty("Prorations");
    if (prorations) {
      this.prorations = prorations.map(
        (proration: any) => new PurchasableProrationResponse(proration),
      );
    }
  }
}

class SecretsManagerInvoicePreviewResponse extends BaseResponse {
  seats?: InvoicePreviewItem;
  additionalServiceAccounts?: InvoicePreviewItem;
  prorations?: PurchasableProration[];

  constructor(response: any) {
    super(response);

    const seats = this.getResponseProperty("Seats");
    if (seats) {
      this.seats = new InvoicePreviewItemResponse(seats);
    }

    const additionalServiceAccounts = this.getResponseProperty("AdditionalServiceAccounts");
    if (additionalServiceAccounts) {
      this.additionalServiceAccounts = new InvoicePreviewItemResponse(additionalServiceAccounts);
    }

    const prorations = this.getResponseProperty("Prorations");
    if (prorations) {
      this.prorations = prorations.map(
        (proration: any) => new PurchasableProrationResponse(proration),
      );
    }
  }
}

export class InvoicePreviewResponse extends BaseResponse implements InvoicePreview {
  passwordManager: {
    seats: InvoicePreviewItem;
    additionalStorage?: InvoicePreviewItem;
    prorations?: PurchasableProration[];
  };
  secretsManager?: {
    seats?: InvoicePreviewItem;
    additionalServiceAccounts?: InvoicePreviewItem;
    prorations?: PurchasableProration[];
  };
  cadence: SubscriptionCadence;
  planTier: PlanTier;
  discounts?: InvoicePreviewDiscount[];
  startingBalance?: number;
  estimatedTax: number;
  total: number;
  amountDue: number;
  nextPaymentAttempt?: Date;

  constructor(response: any) {
    super(response);

    this.passwordManager = new PasswordManagerInvoicePreviewResponse(
      this.getResponseProperty("PasswordManager"),
    );

    const secretsManager = this.getResponseProperty("SecretsManager");
    if (secretsManager) {
      this.secretsManager = new SecretsManagerInvoicePreviewResponse(secretsManager);
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
      this.discounts = discounts.map(
        (discount: any) => new InvoicePreviewDiscountResponse(discount),
      );
    }

    const startingBalance = this.getResponseProperty("StartingBalance");
    if (startingBalance != null) {
      this.startingBalance = startingBalance;
    }

    const estimatedTax = this.getResponseProperty("EstimatedTax");
    if (estimatedTax == null) {
      throw new Error("Failed to parse invoice preview: missing EstimatedTax");
    }
    this.estimatedTax = estimatedTax;

    const total = this.getResponseProperty("Total");
    if (total == null) {
      throw new Error("Failed to parse invoice preview: missing Total");
    }
    this.total = total;

    const amountDue = this.getResponseProperty("AmountDue");
    if (amountDue == null) {
      throw new Error("Failed to parse invoice preview: missing AmountDue");
    }
    this.amountDue = amountDue;

    // Optional, so a malformed date degrades to absent rather than an Invalid Date object.
    const nextPaymentAttempt = this.getResponseProperty("NextPaymentAttempt");
    if (nextPaymentAttempt) {
      const date = new Date(nextPaymentAttempt);
      if (!isNaN(date.getTime())) {
        this.nextPaymentAttempt = date;
      }
    }
  }
}
