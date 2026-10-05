import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, PBKDF2KdfConfig } from "@bitwarden/legacy-crypto";

import { ApiService } from "../../abstractions/api.service";
import { KdfConfigResponse } from "../../key-management/models/response/kdf-config.response";
import { Environment, EnvironmentService } from "../../platform/abstractions/environment.service";

import { PasswordPreloginApiService } from "./password-prelogin-api.service";
import { PasswordPreloginRequest } from "./password-prelogin.request";
import { PasswordPreloginResponse } from "./password-prelogin.response";

describe("PasswordPreloginApiService", () => {
  let apiService: MockProxy<ApiService>;
  let environmentService: MockProxy<EnvironmentService>;
  let sut: PasswordPreloginApiService;

  const identityUrl = "https://identity.example.com";
  const salt = "user@example.com";

  // KdfConfigResponse validates on construction, so every payload needs a well-formed KdfSettings.
  const pbkdf2Payload = {
    KdfSettings: { KdfType: 0, Iterations: PBKDF2KdfConfig.ITERATIONS.defaultValue },
    Salt: salt,
  };

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
      apiService.send.mockResolvedValue(pbkdf2Payload);

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
      apiService.send.mockResolvedValue(pbkdf2Payload);

      const result = await sut.getPreloginData(request);

      expect(result).toBeInstanceOf(PasswordPreloginResponse);
    });

    it("maps kdf settings and salt from the api response", async () => {
      const request = new PasswordPreloginRequest("user@example.com");
      apiService.send.mockResolvedValue({
        KdfSettings: {
          KdfType: 1,
          Iterations: Argon2KdfConfig.ITERATIONS.defaultValue,
          Memory: Argon2KdfConfig.MEMORY.defaultValue,
          Parallelism: Argon2KdfConfig.PARALLELISM.defaultValue,
        },
        Salt: salt,
      });

      const result = await sut.getPreloginData(request);

      expect(result.kdfSettings).toBeInstanceOf(KdfConfigResponse);
      expect(result.kdfSettings.kdfType).toBe(1);
      expect(result.kdfSettings.iterations).toBe(Argon2KdfConfig.ITERATIONS.defaultValue);
      expect(result.kdfSettings.memory).toBe(Argon2KdfConfig.MEMORY.defaultValue);
      expect(result.kdfSettings.parallelism).toBe(Argon2KdfConfig.PARALLELISM.defaultValue);
      expect(result.salt).toBe(salt);
    });

    it("uses the identity url from the environment", async () => {
      const customIdentityUrl = "https://custom.identity.bitwarden.com";
      environmentService.environment$ = of({
        getIdentityUrl: () => customIdentityUrl,
      } satisfies Partial<Environment> as Environment);

      sut = new PasswordPreloginApiService(apiService, environmentService);

      const request = new PasswordPreloginRequest("user@example.com");
      apiService.send.mockResolvedValue(pbkdf2Payload);

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

    // Migrated from password-prelogin.model.spec.ts: response shape is this layer's concern.
    it("maps a camelCase response, matching the casing the server actually serializes", async () => {
      const request = new PasswordPreloginRequest("user@example.com");
      apiService.send.mockResolvedValue({
        kdfSettings: { kdfType: 0, iterations: PBKDF2KdfConfig.ITERATIONS.defaultValue },
        salt,
      });

      const result = await sut.getPreloginData(request);

      expect(result.kdfSettings.kdfType).toBe(0);
      expect(result.kdfSettings.iterations).toBe(PBKDF2KdfConfig.ITERATIONS.defaultValue);
      expect(result.salt).toBe(salt);
    });

    // The server declares Salt as `string?` and returns the nullable User.MasterPasswordSalt
    // column verbatim, so a null reaches the client for accounts that predate the column.
    // The salt fallback that depends on this lives in DefaultPasswordPreloginService.
    it.each([
      { description: "Salt is explicitly null", payload: { Salt: null } },
      { description: "Salt is absent", payload: {} },
    ])("maps a response to a null salt when $description", async ({ payload }) => {
      const request = new PasswordPreloginRequest("user@example.com");
      apiService.send.mockResolvedValue({
        KdfSettings: { KdfType: 0, Iterations: PBKDF2KdfConfig.ITERATIONS.defaultValue },
        ...payload,
      });

      const result = await sut.getPreloginData(request);

      expect(result.salt).toBeNull();
    });

    it("throws when the response omits KdfSettings entirely", async () => {
      const request = new PasswordPreloginRequest("user@example.com");
      apiService.send.mockResolvedValue({ Salt: salt });

      await expect(sut.getPreloginData(request)).rejects.toThrow(
        "KDF config response does not contain a valid KDF type",
      );
    });

    it("propagates api errors", async () => {
      const request = new PasswordPreloginRequest("user@example.com");
      apiService.send.mockRejectedValue(new Error("API Error"));

      await expect(sut.getPreloginData(request)).rejects.toThrow("API Error");
    });
  });
});
