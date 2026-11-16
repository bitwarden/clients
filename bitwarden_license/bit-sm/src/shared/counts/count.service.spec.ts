import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { CountService } from "./count.service";

describe("SecretsManagerService", () => {
  let sut: CountService;

  const apiService = mock<ApiService>();

  beforeEach(() => {
    jest.resetAllMocks();

    sut = new CountService(apiService);
  });

  it("instantiates", () => {
    expect(sut).not.toBeFalsy();
  });

  describe("getOrganizationCounts", () => {
    it("returns counts", async () => {
      apiService.send.mockResolvedValue({
        projects: 1,
        secrets: 2,
        serviceAccounts: 3,
      });

      const organizationId = Utils.newGuid();

      const result = await sut.getOrganizationCounts(organizationId);

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

  describe("getProjectCounts", () => {
    it("returns counts", async () => {
      apiService.send.mockResolvedValue({
        people: 1,
        secrets: 2,
        serviceAccounts: 3,
      });
      const projectId = Utils.newGuid();

      const result = await sut.getProjectCounts(projectId);

      expect(result).not.toBeNull();
      expect(result.people).toEqual(1);
      expect(result.secrets).toEqual(2);
      expect(result.serviceAccounts).toEqual(3);
      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/projects/" + projectId + "/sm-counts",
        null,
        true,
        true,
      );
    });
  });

  describe("getServiceAccountCounts", () => {
    it("returns counts", async () => {
      const serviceAccountId = Utils.newGuid();
      apiService.send.mockResolvedValue({
        projects: 1,
        people: 2,
        accessTokens: 3,
      });

      const result = await sut.getServiceAccountCounts(serviceAccountId);

      expect(result).not.toBeNull();
      expect(result.projects).toEqual(1);
      expect(result.people).toEqual(2);
      expect(result.accessTokens).toEqual(3);
      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/service-accounts/" + serviceAccountId + "/sm-counts",
        null,
        true,
        true,
      );
    });
  });
});
