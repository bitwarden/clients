import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { ServiceAccountService } from "./service-account.service";

describe("ServiceAccountService", () => {
  let sut: ServiceAccountService;

  const cryptoService = mock<CryptoService>();
  const apiService = mock<ApiService>();
  const encryptService = mock<EncryptService>();

  beforeEach(() => {
    jest.resetAllMocks();

    sut = new ServiceAccountService(cryptoService, apiService, encryptService);
  });

  it("instantiates", () => {
    expect(sut).not.toBeFalsy();
  });

  describe("getCounts", () => {
    it("returns counts", async () => {
      const serviceAccountId = Utils.newGuid();
      apiService.send.mockResolvedValue({
        projects: 1,
        people: 2,
        accessTokens: 3,
      });

      const result = await sut.getCounts(serviceAccountId);

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
