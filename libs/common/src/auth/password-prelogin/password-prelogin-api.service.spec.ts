import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, PBKDF2KdfConfig } from "@bitwarden/key-management";

import { ApiService } from "../../abstractions/api.service";
import { Environment, EnvironmentService } from "../../platform/abstractions/environment.service";

import { PasswordPreloginApiService } from "./password-prelogin-api.service";
import { PasswordPreloginRequest } from "./password-prelogin.request";
import { PasswordPreloginResponse } from "./password-prelogin.response";

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
      const request = new PasswordPreloginRequest("user@example.com");
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
      const request = new PasswordPreloginRequest("user@example.com");
      apiService.send.mockResolvedValue({
        Kdf: 0,
        KdfIterations: PBKDF2KdfConfig.ITERATIONS.defaultValue,
      });

      const result = await sut.getPreloginData(request);

      expect(result).toBeInstanceOf(PasswordPreloginResponse);
    });

    it("maps kdf fields from the api response", async () => {
      const request = new PasswordPreloginRequest("user@example.com");
      apiService.send.mockResolvedValue({
        Kdf: 1,
        KdfIterations: Argon2KdfConfig.ITERATIONS.defaultValue,
        KdfMemory: Argon2KdfConfig.MEMORY.defaultValue,
        KdfParallelism: Argon2KdfConfig.PARALLELISM.defaultValue,
      });

      const result = await sut.getPreloginData(request);

      expect(result.kdf).toBe(1);
      expect(result.kdfIterations).toBe(Argon2KdfConfig.ITERATIONS.defaultValue);
      expect(result.kdfMemory).toBe(Argon2KdfConfig.MEMORY.defaultValue);
      expect(result.kdfParallelism).toBe(Argon2KdfConfig.PARALLELISM.defaultValue);
    });

    it("uses the identity url from the environment", async () => {
      const customIdentityUrl = "https://custom.identity.bitwarden.com";
      environmentService.environment$ = of({
        getIdentityUrl: () => customIdentityUrl,
      } satisfies Partial<Environment> as Environment);

      sut = new PasswordPreloginApiService(apiService, environmentService);

      const request = new PasswordPreloginRequest("user@example.com");
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
      const request = new PasswordPreloginRequest("user@example.com");
      apiService.send.mockRejectedValue(new Error("API Error"));

      await expect(sut.getPreloginData(request)).rejects.toThrow("API Error");
    });
  });
});
