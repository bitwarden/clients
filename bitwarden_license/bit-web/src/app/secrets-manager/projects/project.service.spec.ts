import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { ProjectService } from "./project.service";

describe("ProjectService", () => {
  let sut: ProjectService;

  const cryptoService = mock<CryptoService>();
  const apiService = mock<ApiService>();
  const encryptService = mock<EncryptService>();

  beforeEach(() => {
    jest.resetAllMocks();

    sut = new ProjectService(cryptoService, apiService, encryptService);
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
});
