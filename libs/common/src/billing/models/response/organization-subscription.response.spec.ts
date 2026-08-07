import { OrganizationSubscriptionResponse } from "./organization-subscription.response";
import { PendingAnnualUpgradeResponse } from "./pending-annual-upgrade.response";

describe("OrganizationSubscriptionResponse", () => {
  it("parses pendingAnnualUpgrade when present", () => {
    const response = new OrganizationSubscriptionResponse({
      PendingAnnualUpgrade: {
        Plan: { Name: "Teams (Annually)", IsAnnual: true },
        LineItems: [{ Name: "Teams (Annually) Seat", Amount: 48, Quantity: 5, Interval: "year" }],
        EffectiveDate: "2026-08-01T00:00:00Z",
      },
    });

    expect(response.pendingAnnualUpgrade).not.toBeNull();
    expect(response.pendingAnnualUpgrade!.plan.name).toBe("Teams (Annually)");
    expect(response.pendingAnnualUpgrade!.lineItems[0].interval).toBe("year");
    expect(response.pendingAnnualUpgrade!.effectiveDate).toEqual(new Date("2026-08-01T00:00:00Z"));
  });

  it("leaves pendingAnnualUpgrade undefined when absent", () => {
    const response = new OrganizationSubscriptionResponse({});
    expect(response.pendingAnnualUpgrade).toBeUndefined();
  });

  it("leaves lineItems undefined when the server omits them for view-only admins", () => {
    const response = new PendingAnnualUpgradeResponse({
      Plan: { Name: "Teams (Annual)" },
      EffectiveDate: "2026-08-06T00:00:00Z",
    });

    expect(response.lineItems).toBeUndefined();
    expect(response.plan).toBeDefined();
    expect(response.effectiveDate).toEqual(new Date("2026-08-06T00:00:00Z"));
  });

  it("maps lineItems when the server sends them", () => {
    const response = new PendingAnnualUpgradeResponse({
      Plan: { Name: "Teams (Annual)" },
      LineItems: [{ Name: "Seat", Amount: 48, Quantity: 3 }],
      EffectiveDate: "2026-08-06T00:00:00Z",
    });

    expect(response.lineItems).toHaveLength(1);
    expect(response.lineItems[0].name).toBe("Seat");
  });
});
