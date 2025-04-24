import { BaseResponse } from "../../../models/response/base.response";

export class OrganizationWarningsResponse extends BaseResponse {
  freeTrial?: FreeTrialWarningResponse;
  inactiveSubscription?: InactiveSubscriptionWarningResponse;
  resellerRenewal?: ResellerRenewalWarningResponse;

  constructor(response: any) {
    super(response);
    const freeTrialWarning = this.getResponseProperty("freeTrial");
    if (freeTrialWarning) {
      this.freeTrial = new FreeTrialWarningResponse(freeTrialWarning);
    }
    const inactiveSubscriptionWarning = this.getResponseProperty("inactiveSubscription");
    if (inactiveSubscriptionWarning) {
      this.inactiveSubscription = new InactiveSubscriptionWarningResponse(
        inactiveSubscriptionWarning,
      );
    }
    const resellerWarning = this.getResponseProperty("resellerRenewal");
    if (resellerWarning) {
      this.resellerRenewal = new ResellerRenewalWarningResponse(resellerWarning);
    }
  }
}

class FreeTrialWarningResponse extends BaseResponse {
  remainingTrialDays: number;

  constructor(response: any) {
    super(response);
    this.remainingTrialDays = this.getResponseProperty("remainingTrialDays");
  }
}

class InactiveSubscriptionWarningResponse extends BaseResponse {
  resolution: string;

  constructor(response: any) {
    super(response);
    this.resolution = this.getResponseProperty("resolution");
  }
}

class ResellerRenewalWarningResponse extends BaseResponse {
  type: string;
  upcoming?: UpcomingRenewal;
  issued?: IssuedRenewal;
  pastDue?: PastDueRenewal;

  constructor(response: any) {
    super(response);
    this.type = this.getResponseProperty("type");
    switch (this.type) {
      case "upcoming": {
        this.upcoming = new UpcomingRenewal(this.getResponseProperty("upcoming"));
        break;
      }
      case "issued": {
        this.issued = new IssuedRenewal(this.getResponseProperty("issued"));
        break;
      }
      case "past_due": {
        this.pastDue = new PastDueRenewal(this.getResponseProperty("pastDue"));
      }
    }
  }
}

class UpcomingRenewal extends BaseResponse {
  renewalDate: Date;

  constructor(response: any) {
    super(response);
    this.renewalDate = new Date(this.getResponseProperty("renewalDate"));
  }
}

class IssuedRenewal extends BaseResponse {
  issuedDate: Date;
  dueDate: Date;

  constructor(response: any) {
    super(response);
    this.issuedDate = new Date(this.getResponseProperty("issuedDate"));
    this.dueDate = new Date(this.getResponseProperty("dueDate"));
  }
}

class PastDueRenewal extends BaseResponse {
  suspensionDate: Date;

  constructor(response: any) {
    super(response);
    this.suspensionDate = new Date(this.getResponseProperty("suspensionDate"));
  }
}
