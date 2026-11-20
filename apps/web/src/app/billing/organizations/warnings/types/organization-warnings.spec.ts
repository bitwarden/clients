import { OrganizationWarningsResponse } from "./organization-warnings";

describe("OrganizationWarningsResponse", () => {
  describe("freeTrial", () => {
    it("parses RemainingTrialDays and IsSalesAssisted when present", () => {
      const response = new OrganizationWarningsResponse({
        FreeTrial: { RemainingTrialDays: 5, IsSalesAssisted: true },
      });

      expect(response.freeTrial?.remainingTrialDays).toBe(5);
      expect(response.freeTrial?.isSalesAssisted).toBe(true);
    });

    it("parses IsSalesAssisted as false when the server sends false", () => {
      const response = new OrganizationWarningsResponse({
        FreeTrial: { RemainingTrialDays: 5, IsSalesAssisted: false },
      });

      expect(response.freeTrial?.isSalesAssisted).toBe(false);
    });

    it("defaults isSalesAssisted to false when the server omits the field", () => {
      const response = new OrganizationWarningsResponse({
        FreeTrial: { RemainingTrialDays: 5 },
      });

      expect(response.freeTrial?.isSalesAssisted).toBe(false);
    });
  });
});
