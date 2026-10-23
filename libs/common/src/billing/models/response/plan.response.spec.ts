import { PlanResponse, PrivilegedControlsPlanFeaturesResponse } from "./plan.response";

describe("PlanResponse", () => {
  it("parses PrivilegedControls when present", () => {
    const response = new PlanResponse({
      PrivilegedControls: { SeatPrice: 5, DefaultSeatMinimum: 10 },
    });

    expect(response.PrivilegedControls).toBeInstanceOf(PrivilegedControlsPlanFeaturesResponse);
    expect(response.PrivilegedControls!.seatPrice).toBe(5);
    expect(response.PrivilegedControls!.defaultSeatMinimum).toBe(10);
  });

  it("leaves PrivilegedControls undefined when absent", () => {
    const response = new PlanResponse({});

    expect(response.PrivilegedControls).toBeUndefined();
  });

  it("leaves PrivilegedControls undefined when null", () => {
    const response = new PlanResponse({ PrivilegedControls: null });

    expect(response.PrivilegedControls).toBeUndefined();
  });

  it("still parses SecretsManager alongside PrivilegedControls", () => {
    const response = new PlanResponse({
      SecretsManager: { StripeSeatPlanId: "sm-seat", SeatPrice: 7, BaseSeats: 1 },
      PrivilegedControls: { SeatPrice: 5, DefaultSeatMinimum: 10 },
    });

    expect(response.SecretsManager.stripeSeatPlanId).toBe("sm-seat");
    expect(response.SecretsManager.seatPrice).toBe(7);
    expect(response.SecretsManager.baseSeats).toBe(1);
  });
});
