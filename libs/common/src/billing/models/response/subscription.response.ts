// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BaseResponse } from "../../../models/response/base.response";

import { BillingCustomerDiscount } from "./organization-subscription.response";

export class SubscriptionResponse extends BaseResponse {
  storageName: string;
  storageGb: number;
  maxStorageGb: number;
  subscription: BillingSubscriptionResponse;
  upcomingInvoice: BillingSubscriptionUpcomingInvoiceResponse;
  customerDiscount: BillingCustomerDiscount;
  license: any;
  expiration: string;

  constructor(response: any) {
    super(response);
    this.storageName = this.getResponseProperty("StorageName");
    this.storageGb = this.getResponseProperty("StorageGb");
    this.maxStorageGb = this.getResponseProperty("MaxStorageGb");
    this.license = this.getResponseProperty("License");
    this.expiration = this.getResponseProperty("Expiration");
    const subscription = this.getResponseProperty("Subscription");
    const upcomingInvoice = this.getResponseProperty("UpcomingInvoice");
    const customerDiscount = this.getResponseProperty("CustomerDiscount");
    this.subscription = subscription == null ? null : new BillingSubscriptionResponse(subscription);
    this.upcomingInvoice =
      upcomingInvoice == null
        ? null
        : new BillingSubscriptionUpcomingInvoiceResponse(upcomingInvoice);
    this.customerDiscount =
      customerDiscount == null ? null : new BillingCustomerDiscount(customerDiscount);
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
  collectionMethod: string;
  suspensionDate?: string;
  unpaidPeriodEndDate?: string;
  gracePeriod?: number;

  constructor(response: any) {
    super(response);
    this.trialStartDate = this.getResponseProperty("TrialStartDate");
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
    this.collectionMethod = this.getResponseProperty("CollectionMethod");
    this.suspensionDate = this.getResponseProperty("SuspensionDate");
    this.unpaidPeriodEndDate = this.getResponseProperty("unpaidPeriodEndDate");
    this.gracePeriod = this.getResponseProperty("GracePeriod");
  }
}

export class BillingSubscriptionItemResponse extends BaseResponse {
  productId: string;
  name: string;
  amount: number;
  quantity: number;
  interval: string;
  sponsoredSubscriptionItem: boolean;
  addonSubscriptionItem: boolean;
  productName: string;

  constructor(response: any) {
    super(response);
    this.productId = this.getResponseProperty("ProductId");
    this.name = this.getResponseProperty("Name");
    this.amount = this.getResponseProperty("Amount");
    this.quantity = this.getResponseProperty("Quantity");
    this.interval = this.getResponseProperty("Interval");
    this.sponsoredSubscriptionItem = this.getResponseProperty("SponsoredSubscriptionItem");
    this.addonSubscriptionItem = this.getResponseProperty("AddonSubscriptionItem");
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

