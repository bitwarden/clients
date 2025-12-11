import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "../../../abstractions/api.service";
import { KeyConnectorConfirmationDetailsResponse } from "../models/response/key-connector-confirmation-details.response";

import { DefaultKeyConnectorApiService } from "./default-key-connector-api.service";

describe("DefaultKeyConnectorApiService", () => {
  let apiService: MockProxy<ApiService>;
  let sut: DefaultKeyConnectorApiService;

  beforeEach(() => {
    apiService = mock<ApiService>();
    sut = new DefaultKeyConnectorApiService(apiService);
  });

  describe("getConfirmationDetails", () => {
    it("encodes orgSsoIdentifier in URL", async () => {
      const orgSsoIdentifier = "test org/with special@chars";
      const expectedEncodedIdentifier = encodeURIComponent(orgSsoIdentifier);
      const mockResponse = {};
      apiService.send.mockResolvedValue(mockResponse);

      await sut.getConfirmationDetails(orgSsoIdentifier);

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        `/accounts/key-connector/confirmation-details/${expectedEncodedIdentifier}`,
        null,
        true,
        true,
      );
    });

    it("returns expected response", async () => {
      const orgSsoIdentifier = "test-org";
      const expectedOrgName = "example";
      const mockResponse = { OrganizationName: expectedOrgName };
      apiService.send.mockResolvedValue(mockResponse);

      const result = await sut.getConfirmationDetails(orgSsoIdentifier);

      expect(result).toBeInstanceOf(KeyConnectorConfirmationDetailsResponse);
      expect(result.organizationName).toBe(expectedOrgName);
      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/accounts/key-connector/confirmation-details/test-org",
        null,
        true,
        true,
      );
    });
  });
});
