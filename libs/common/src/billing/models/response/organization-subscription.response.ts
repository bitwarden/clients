// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OrganizationResponse } from "../../../admin-console/models/response/organization.response";
import { BaseResponse } from "../../../models/response/base.response";

import {
  BillingSubscriptionResponse,
  BillingSubscriptionUpcomingInvoiceResponse,
} from "./subscription.response";

export class OrganizationSubscriptionResponse extends OrganizationResponse {
  storageName: string;
  storageGb: number;
  subscription: BillingSubscriptionResponse;
  upcomingInvoice: BillingSubscriptionUpcomingInvoiceResponse;
  customerDiscount: BillingCustomerDiscount;
  expiration: string;
  expirationWithoutGracePeriod: string;

  constructor(response: any) {
    super(response);
    this.storageName = this.getResponseProperty("StorageName");
    this.storageGb = this.getResponseProperty("StorageGb");
    const subscription = this.getResponseProperty("Subscription");
    this.subscription = subscription == null ? null : new BillingSubscriptionResponse(subscription);
    const upcomingInvoice = this.getResponseProperty("UpcomingInvoice");
    this.upcomingInvoice =
      upcomingInvoice == null
        ? null
        : new BillingSubscriptionUpcomingInvoiceResponse(upcomingInvoice);
    const customerDiscount = this.getResponseProperty("CustomerDiscount");
    this.customerDiscount =
      customerDiscount == null ? null : new BillingCustomerDiscount(customerDiscount);
    this.expiration = this.getResponseProperty("Expiration");
    this.expirationWithoutGracePeriod = this.getResponseProperty("ExpirationWithoutGracePeriod");
  }
}

export class BillingCustomerDiscount extends BaseResponse {
  id: string;
  active: boolean;
  percentOff?: number;
  appliesTo: string[];

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.active = this.getResponseProperty("Active");
    this.percentOff = this.getResponseProperty("PercentOff");
    this.appliesTo = this.getResponseProperty("AppliesTo");
  }
}
