import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export type OrganizationFreeTrialWarning = {
  organization: Pick<Organization, "id" & "name">;
  message: string;
};

export type OrganizationResellerRenewalWarning = {
  type: "info" | "warning";
  message: string;
};

export class OrganizationWarningsResponse extends BaseResponse {
  freeTrial?: FreeTrialWarningResponse;
  inactiveSubscription?: InactiveSubscriptionWarningResponse;
  resellerRenewal?: ResellerRenewalWarningResponse;

  constructor(response: any) {
    super(response);
    const freeTrialWarning = this.getResponseProperty("FreeTrial");
    if (freeTrialWarning) {
      this.freeTrial = new FreeTrialWarningResponse(freeTrialWarning);
    }
    const inactiveSubscriptionWarning = this.getResponseProperty("InactiveSubscription");
    if (inactiveSubscriptionWarning) {
      this.inactiveSubscription = new InactiveSubscriptionWarningResponse(
        inactiveSubscriptionWarning,
      );
    }
    const resellerWarning = this.getResponseProperty("ResellerRenewal");
    if (resellerWarning) {
      this.resellerRenewal = new ResellerRenewalWarningResponse(resellerWarning);
    }
  }
}

class FreeTrialWarningResponse extends BaseResponse {
  remainingTrialDays: number;

  constructor(response: any) {
    super(response);
    this.remainingTrialDays = this.getResponseProperty("RemainingTrialDays");
  }
}

class InactiveSubscriptionWarningResponse extends BaseResponse {
  resolution: string;

  constructor(response: any) {
    super(response);
    this.resolution = this.getResponseProperty("Resolution");
  }
}

class ResellerRenewalWarningResponse extends BaseResponse {
  type: "upcoming" | "issued" | "past_due";
  upcoming?: UpcomingRenewal;
  issued?: IssuedRenewal;
  pastDue?: PastDueRenewal;

  constructor(response: any) {
    super(response);
    this.type = this.getResponseProperty("Type");
    switch (this.type) {
      case "upcoming": {
        this.upcoming = new UpcomingRenewal(this.getResponseProperty("Upcoming"));
        break;
      }
      case "issued": {
        this.issued = new IssuedRenewal(this.getResponseProperty("Issued"));
        break;
      }
      case "past_due": {
        this.pastDue = new PastDueRenewal(this.getResponseProperty("PastDue"));
      }
    }
  }
}

class UpcomingRenewal extends BaseResponse {
  renewalDate: Date;

  constructor(response: any) {
    super(response);
    this.renewalDate = new Date(this.getResponseProperty("RenewalDate"));
  }
}

class IssuedRenewal extends BaseResponse {
  issuedDate: Date;
  dueDate: Date;

  constructor(response: any) {
    super(response);
    this.issuedDate = new Date(this.getResponseProperty("IssuedDate"));
    this.dueDate = new Date(this.getResponseProperty("DueDate"));
  }
}

class PastDueRenewal extends BaseResponse {
  suspensionDate: Date;

  constructor(response: any) {
    super(response);
    this.suspensionDate = new Date(this.getResponseProperty("SuspensionDate"));
  }
}
