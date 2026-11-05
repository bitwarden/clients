import { PlanResponse, PrivilegedControlsPlanFeaturesResponse } from "./plan.response";

describe("PlanResponse", () => {
  const passwordManager = { StripeSeatPlanId: "password-manager-seat", SeatPrice: 72 };

  it("parses the PrivilegedControls section", () => {
    const response = new PlanResponse({
      PasswordManager: passwordManager,
      PrivilegedControls: {
        StripeSeatPlanId: "privileged-controls-enterprise-seat-annually",
        SeatPrice: 120,
        BaseSeats: 0,
      },
    });

    expect(response.PrivilegedControls.seatPrice).toBe(120);
    expect(response.PrivilegedControls.baseSeats).toBe(0);
    expect(response.PrivilegedControls.stripeSeatPlanId).toBe(
      "privileged-controls-enterprise-seat-annually",
    );
  });

  it("parses PrivilegedControls when present", () => {
    const response = new PlanResponse({
      PrivilegedControls: { SeatPrice: 5 },
    });

    expect(response.PrivilegedControls).toBeInstanceOf(PrivilegedControlsPlanFeaturesResponse);
    expect(response.PrivilegedControls!.seatPrice).toBe(5);
  });

  it("leaves PrivilegedControls null when absent", () => {
    const response = new PlanResponse({});

    expect(response.PrivilegedControls).toBeNull();
  });

  it("leaves PrivilegedControls null when null", () => {
    const response = new PlanResponse({ PrivilegedControls: null });

    expect(response.PrivilegedControls).toBeNull();
  });

  it("still parses SecretsManager alongside PrivilegedControls", () => {
    const response = new PlanResponse({
      SecretsManager: { StripeSeatPlanId: "sm-seat", SeatPrice: 7, BaseSeats: 1 },
      PrivilegedControls: { SeatPrice: 5 },
    });

    expect(response.SecretsManager.stripeSeatPlanId).toBe("sm-seat");
    expect(response.SecretsManager.seatPrice).toBe(7);
    expect(response.SecretsManager.baseSeats).toBe(1);
  });
});
