import { PreValidateSponsorshipResponse } from "./pre-validate-sponsorship.response";

describe("PreValidateSponsorshipResponse", () => {
  const baseResponse = {
    IsTokenValid: true,
    IsFreeFamilyPolicyEnabled: false,
  };

  it("deserializes isTokenValid and isFreeFamilyPolicyEnabled", () => {
    const sut = new PreValidateSponsorshipResponse(baseResponse);

    expect(sut.isTokenValid).toBe(true);
    expect(sut.isFreeFamilyPolicyEnabled).toBe(false);
  });

  it("deserializes sponsoringOrganizationName when present", () => {
    const sut = new PreValidateSponsorshipResponse({
      ...baseResponse,
      SponsoringOrganizationName: "Acme Inc",
    });

    expect(sut.sponsoringOrganizationName).toBe("Acme Inc");
  });

  it("leaves sponsoringOrganizationName undefined when the server omits it", () => {
    const sut = new PreValidateSponsorshipResponse(baseResponse);

    expect(sut.sponsoringOrganizationName).toBeUndefined();
  });

  it("accepts a camelCase payload", () => {
    const sut = new PreValidateSponsorshipResponse({
      isTokenValid: true,
      isFreeFamilyPolicyEnabled: false,
      sponsoringOrganizationName: "Acme Inc",
    });

    expect(sut.sponsoringOrganizationName).toBe("Acme Inc");
  });
});
