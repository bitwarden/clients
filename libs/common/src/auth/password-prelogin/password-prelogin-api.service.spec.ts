import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";


import { ApiService } from "../../abstractions/api.service";
import { Environment , EnvironmentService } from "../../platform/abstractions/environment.service";

import { PasswordPreloginApiService } from "./password-prelogin-api.service";
import { PreloginRequest } from "./prelogin.request";
import { PreloginResponse } from "./prelogin.response";

describe("PasswordPreloginApiService", () => {
  let apiService: MockProxy<ApiService>;
  let environmentService: MockProxy<EnvironmentService>;
  let sut: PasswordPreloginApiService;

  const identityUrl = "https://identity.example.com";

  beforeEach(() => {
    apiService = mock<ApiService>();
    environmentService = mock<EnvironmentService>();

    environmentService.environment$ = of({
      getIdentityUrl: () => identityUrl,
    } satisfies Partial<Environment> as Environment);

    sut = new PasswordPreloginApiService(apiService, environmentService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("getPreloginData", () => {
    it("calls apiService.send with correct parameters", async () => {
      const request = new PreloginRequest("user@example.com");
      apiService.send.mockResolvedValue({});

      await sut.getPreloginData(request);

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/accounts/prelogin/password",
        request,
        false,
        true,
        identityUrl,
      );
    });

    it("returns a PreloginResponse", async () => {
      const request = new PreloginRequest("user@example.com");
      apiService.send.mockResolvedValue({ Kdf: 0, KdfIterations: 600000 });

      const result = await sut.getPreloginData(request);

      expect(result).toBeInstanceOf(PreloginResponse);
    });

    it("maps kdf fields from the api response", async () => {
      const request = new PreloginRequest("user@example.com");
      apiService.send.mockResolvedValue({
        Kdf: 1,
        KdfIterations: 3,
        KdfMemory: 64,
        KdfParallelism: 4,
      });

      const result = await sut.getPreloginData(request);

      expect(result.kdf).toBe(1);
      expect(result.kdfIterations).toBe(3);
      expect(result.kdfMemory).toBe(64);
      expect(result.kdfParallelism).toBe(4);
    });

    it("uses the identity url from the environment", async () => {
      const customIdentityUrl = "https://custom.identity.bitwarden.com";
      environmentService.environment$ = of({
        getIdentityUrl: () => customIdentityUrl,
      } satisfies Partial<Environment> as Environment);

      sut = new PasswordPreloginApiService(apiService, environmentService);

      const request = new PreloginRequest("user@example.com");
      apiService.send.mockResolvedValue({});

      await sut.getPreloginData(request);

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/accounts/prelogin/password",
        request,
        false,
        true,
        customIdentityUrl,
      );
    });

    it("propagates api errors", async () => {
      const request = new PreloginRequest("user@example.com");
      apiService.send.mockRejectedValue(new Error("API Error"));

      await expect(sut.getPreloginData(request)).rejects.toThrow("API Error");
    });
  });
});
