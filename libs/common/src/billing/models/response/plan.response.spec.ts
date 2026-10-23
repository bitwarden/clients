import { PlanResponse } from "./plan.response";

describe("PlanResponse", () => {
  const passwordManager = { StripeSeatPlanId: "password-manager-seat", SeatPrice: 72 };

  it("parses the PrivilegedControls section", () => {
    const response = new PlanResponse({
      PasswordManager: passwordManager,
      PrivilegedControls: {
        StripeSeatPlanId: "privileged-controls-enterprise-seat-annually",
        SeatPrice: 120,
        BaseSeats: 0,
        DefaultSeatMinimum: 10,
      },
    });

    expect(response.PrivilegedControls.seatPrice).toBe(120);
    expect(response.PrivilegedControls.defaultSeatMinimum).toBe(10);
    expect(response.PrivilegedControls.baseSeats).toBe(0);
    expect(response.PrivilegedControls.stripeSeatPlanId).toBe(
      "privileged-controls-enterprise-seat-annually",
    );
  });

  it("sets PrivilegedControls to null when the server omits it", () => {
    const response = new PlanResponse({ PasswordManager: passwordManager });

    expect(response.PrivilegedControls).toBeNull();
  });
});
