import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { SecretsManagerService } from "./secrets-manager.service";

describe("SecretsManagerService", () => {
  let sut: SecretsManagerService;

  const apiService = mock<ApiService>();

  beforeEach(() => {
    jest.resetAllMocks();

    sut = new SecretsManagerService(apiService);
  });

  it("instantiates", () => {
    expect(sut).not.toBeFalsy();
  });

  describe("getCounts", () => {
    it("returns counts", async () => {
      apiService.send.mockResolvedValue({
        projects: 1,
        secrets: 2,
        serviceAccounts: 3,
      });

      const organizationId = Utils.newGuid();

      const result = await sut.getCounts(organizationId);

      expect(result).not.toBeNull();
      expect(result.projects).toEqual(1);
      expect(result.secrets).toEqual(2);
      expect(result.serviceAccounts).toEqual(3);
      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/organizations/" + organizationId + "/sm-counts",
        null,
        true,
        true,
      );
    });
  });
});
