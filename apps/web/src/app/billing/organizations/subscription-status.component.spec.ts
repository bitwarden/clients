import { DatePipe } from "@angular/common";
import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { BillingSubscriptionResponse } from "@bitwarden/common/billing/models/response/subscription.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SubscriptionStatusComponent } from "./subscription-status.component";

function makeSubscription(
  overrides: Partial<BillingSubscriptionResponse> = {},
): BillingSubscriptionResponse {
  return {
    status: "active",
    cancelAtEndDate: false,
    cancelledDate: null,
    cancelled: false,
    items: [],
    ...overrides,
  } as BillingSubscriptionResponse;
}

function makeOrgResponse(
  subscription: BillingSubscriptionResponse | null,
): OrganizationSubscriptionResponse {
  return { subscription } as OrganizationSubscriptionResponse;
}

describe("SubscriptionStatusComponent", () => {
  let component: SubscriptionStatusComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SubscriptionStatusComponent,
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: DatePipe, useValue: mock<DatePipe>() },
      ],
    });

    component = TestBed.inject(SubscriptionStatusComponent);
  });

  describe("status getter", () => {
    it("returns 'free' when there is no subscription", () => {
      component.organizationSubscriptionResponse = makeOrgResponse(null);
      expect(component.status).toBe("free");
    });

    it("returns the subscription status when no cancellation is pending", () => {
      component.organizationSubscriptionResponse = makeOrgResponse(
        makeSubscription({ status: "active" }),
      );
      expect(component.status).toBe("active");
    });

    it("returns 'pending_cancellation' when cancelAtEndDate is true", () => {
      component.organizationSubscriptionResponse = makeOrgResponse(
        makeSubscription({ cancelAtEndDate: true }),
      );
      expect(component.status).toBe("pending_cancellation");
    });

    it("returns 'pending_cancellation' when cancelledDate is set (phase-based cancellation)", () => {
      component.organizationSubscriptionResponse = makeOrgResponse(
        makeSubscription({ cancelledDate: "2026-05-01" }),
      );
      expect(component.status).toBe("pending_cancellation");
    });

    it("returns 'canceled' even when cancelAtEndDate is true", () => {
      component.organizationSubscriptionResponse = makeOrgResponse(
        makeSubscription({ status: "canceled", cancelAtEndDate: true }),
      );
      expect(component.status).toBe("canceled");
    });

    it("returns 'canceled' even when cancelledDate is set", () => {
      component.organizationSubscriptionResponse = makeOrgResponse(
        makeSubscription({ status: "canceled", cancelledDate: "2026-05-01" }),
      );
      expect(component.status).toBe("canceled");
    });

    it("returns 'trialing' when status is trialing", () => {
      component.organizationSubscriptionResponse = makeOrgResponse(
        makeSubscription({ status: "trialing" }),
      );
      expect(component.status).toBe("trialing");
    });

    it("returns 'past_due' when status is past_due", () => {
      component.organizationSubscriptionResponse = makeOrgResponse(
        makeSubscription({ status: "past_due" }),
      );
      expect(component.status).toBe("past_due");
    });

    it("returns 'unpaid' when status is unpaid", () => {
      component.organizationSubscriptionResponse = makeOrgResponse(
        makeSubscription({ status: "unpaid" }),
      );
      expect(component.status).toBe("unpaid");
    });

    it("returns 'incomplete_expired' when status is incomplete_expired", () => {
      component.organizationSubscriptionResponse = makeOrgResponse(
        makeSubscription({ status: "incomplete_expired" }),
      );
      expect(component.status).toBe("incomplete_expired");
    });
  });
});
