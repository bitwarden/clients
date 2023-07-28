import { BaseResponse } from "../../../models/response/base.response";
import { BitwardenProductType } from "../../enums";

export class SubscriptionResponse extends BaseResponse {
  storageName: string;
  storageGb: number;
  maxStorageGb: number;
  subscription: BillingSubscriptionResponse;
  upcomingInvoice: BillingSubscriptionUpcomingInvoiceResponse;
  license: any;
  expiration: string;
  usingInAppPurchase: boolean;

  constructor(response: any) {
    super(response);
    this.storageName = this.getResponseProperty("StorageName");
    this.storageGb = this.getResponseProperty("StorageGb");
    this.maxStorageGb = this.getResponseProperty("MaxStorageGb");
    this.license = this.getResponseProperty("License");
    this.expiration = this.getResponseProperty("Expiration");
    this.usingInAppPurchase = this.getResponseProperty("UsingInAppPurchase");
    const subscription = this.getResponseProperty("Subscription");
    const upcomingInvoice = this.getResponseProperty("UpcomingInvoice");
    this.subscription = subscription == null ? null : new BillingSubscriptionResponse(subscription);
    this.upcomingInvoice =
      upcomingInvoice == null
        ? null
        : new BillingSubscriptionUpcomingInvoiceResponse(upcomingInvoice);
  }
}

export class BillingSubscriptionResponse extends BaseResponse {
  trialStartDate: string;
  trialEndDate: string;
  periodStartDate: string;
  periodEndDate: string;
  cancelledDate: string;
  cancelAtEndDate: boolean;
  status: string;
  cancelled: boolean;
  items: BillingSubscriptionItemResponse[] = [];

  constructor(response: any) {
    super(response);
    this.trialEndDate = this.getResponseProperty("TrialStartDate");
    this.trialEndDate = this.getResponseProperty("TrialEndDate");
    this.periodStartDate = this.getResponseProperty("PeriodStartDate");
    this.periodEndDate = this.getResponseProperty("PeriodEndDate");
    this.cancelledDate = this.getResponseProperty("CancelledDate");
    this.cancelAtEndDate = this.getResponseProperty("CancelAtEndDate");
    this.status = this.getResponseProperty("Status");
    this.cancelled = this.getResponseProperty("Cancelled");
    const items = this.getResponseProperty("Items");
    if (items != null) {
      this.items = items.map((i: any) => new BillingSubscriptionItemResponse(i));
    }
  }
}

export class BillingSubscriptionItemResponse extends BaseResponse {
  name: string;
  amount: number;
  quantity: number;
  interval: string;
  sponsoredSubscriptionItem: boolean;
  addonSubscriptionItem: boolean;
  bitwardenProduct: BitwardenProductType;

  constructor(response: any) {
    super(response);
    this.name = this.getResponseProperty("Name");
    this.amount = this.getResponseProperty("Amount");
    this.quantity = this.getResponseProperty("Quantity");
    this.interval = this.getResponseProperty("Interval");
    this.sponsoredSubscriptionItem = this.getResponseProperty("SponsoredSubscriptionItem");
    this.addonSubscriptionItem = this.getResponseProperty("AddonSubscriptionItem");
    this.bitwardenProduct = this.getResponseProperty("BitwardenProduct");
  }
}

export class BillingSubscriptionUpcomingInvoiceResponse extends BaseResponse {
  date: string;
  amount?: number;

  constructor(response: any) {
    super(response);
    this.date = this.getResponseProperty("Date");
    this.amount = this.getResponseProperty("Amount");
  }
}
