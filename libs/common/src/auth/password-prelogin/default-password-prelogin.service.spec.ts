import { MockProxy, mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { PBKDF2KdfConfig } from "@bitwarden/legacy-crypto";
import { PasswordPreloginResponse as SdkPasswordPreloginResponse } from "@bitwarden/sdk-internal";

import { FeatureFlag } from "../../enums/feature-flag.enum";
import { MasterPasswordSalt } from "../../key-management/master-password/types/master-password.types";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { MockSdkService } from "../../platform/spec/mock-sdk.service";

import { DefaultPasswordPreloginService } from "./default-password-prelogin.service";
import { PasswordPreloginApiService } from "./password-prelogin-api.service";
import { PasswordPreloginData } from "./password-prelogin.model";
import { PasswordPreloginRequest } from "./password-prelogin.request";
import { PasswordPreloginResponse } from "./password-prelogin.response";

// Fetching now awaits the feature flag before calling the API/SDK, so callers must let that
// microtask resolve before asserting on the underlying mock.
const scheduler = typeof setImmediate === "function" ? setImmediate : setTimeout;
function flushPromises() {
  return new Promise((resolve) => scheduler(resolve));
}

describe("DefaultPasswordPreloginService", () => {
  let apiService: MockProxy<PasswordPreloginApiService>;
  let sdkService: MockSdkService;
  let configService: MockProxy<ConfigService>;
  let sut: DefaultPasswordPreloginService;

  const email = "user@example.com";
  const emailA = "a@example.com";
  const emailB = "b@example.com";

  // The API and SDK paths return different salts so tests can prove which source was used.
  const apiSalt = "api-salt" as MasterPasswordSalt;
  const sdkSalt = "sdk-salt" as MasterPasswordSalt;

  // PBKDF2 backs the shared fixtures; KDF type coverage lives in the "kdf config" describe.
  const response = new PasswordPreloginResponse({
    KdfSettings: { KdfType: 0, Iterations: PBKDF2KdfConfig.ITERATIONS.defaultValue },
    Salt: apiSalt,
  });
  const sdkResponse: SdkPasswordPreloginResponse = {
    kdf: { pBKDF2: { iterations: PBKDF2KdfConfig.ITERATIONS.defaultValue } },
    salt: sdkSalt,
  };
  // With the flag off, the API path ignores the server's salt and derives from the email.
  const expectedDataFor = (forEmail: string) =>
    new PasswordPreloginData(
      new PBKDF2KdfConfig(PBKDF2KdfConfig.ITERATIONS.defaultValue),
      forEmail as MasterPasswordSalt,
    );
  const expectedData = expectedDataFor(email);
  const expectedSdkData = new PasswordPreloginData(
    new PBKDF2KdfConfig(PBKDF2KdfConfig.ITERATIONS.defaultValue),
    sdkSalt,
  );

  beforeEach(() => {
    apiService = mock<PasswordPreloginApiService>();
    apiService.getPreloginData.mockResolvedValue(response);

    sdkService = new MockSdkService();
    sdkService.client.auth
      .mockDeep()
      .login.mockDeep()
      .get_password_prelogin.mockResolvedValue(sdkResponse);

    configService = mock<ConfigService>();
    configService.getFeatureFlag.mockResolvedValue(false);

    sut = new DefaultPasswordPreloginService(apiService, sdkService, configService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("getPreloginData$", () => {
    it("fetches, maps, and emits prelogin data from the API when the flag is off", async () => {
      const result = await firstValueFrom(sut.getPreloginData$(email));

      expect(result).toEqual(expectedData);
      expect(apiService.getPreloginData).toHaveBeenCalledTimes(1);
      expect(apiService.getPreloginData).toHaveBeenCalledWith(new PasswordPreloginRequest(email));
    });

    it("fetches, maps, and emits prelogin data from the SDK when the flag is on", async () => {
      configService.getFeatureFlag.mockResolvedValue(true);

      const result = await firstValueFrom(sut.getPreloginData$(email));

      expect(result).toEqual(expectedSdkData);
      expect(apiService.getPreloginData).not.toHaveBeenCalled();
    });

    it("checks the feature flag with the expected key", async () => {
      await firstValueFrom(sut.getPreloginData$(email));

      expect(configService.getFeatureFlag).toHaveBeenCalledWith(
        FeatureFlag.PM27060_PasswordPreloginFromSdk,
      );
    });

    // The flag is read once, here, and its outcome travels with the returned data. A second read
    // downstream could observe a different value and disagree with the fetch that produced it.
    it("reads the feature flag exactly once per fetch", async () => {
      await firstValueFrom(sut.getPreloginData$(email));

      expect(configService.getFeatureFlag).toHaveBeenCalledTimes(1);
    });

    describe("salt resolution", () => {
      it("ignores the server-supplied salt and uses the email when the flag is off", async () => {
        const result = await firstValueFrom(sut.getPreloginData$(email));

        expect(result.salt).toBe(email);
        expect(result.salt).not.toBe(apiSalt);
      });

      // The strategy hands the salt straight to makeMasterKey, which calls .trim() on it, so a
      // null salt crashes login. Servers return none for accounts that predate the salt column.
      it.each([
        { description: "omits Salt", body: {} },
        { description: "sends an explicit null Salt", body: { Salt: null } },
      ])(
        "uses the email when the flag is off and the API response $description",
        async ({ body }) => {
          apiService.getPreloginData.mockResolvedValue(
            new PasswordPreloginResponse({
              KdfSettings: { KdfType: 0, Iterations: PBKDF2KdfConfig.ITERATIONS.defaultValue },
              ...body,
            }),
          );

          const result = await firstValueFrom(sut.getPreloginData$(email));

          expect(result.salt).toBe(email);
        },
      );

      it("uses the normalized email when the flag is off", async () => {
        const result = await firstValueFrom(sut.getPreloginData$("  USER@EXAMPLE.COM  "));

        expect(result.salt).toBe(email);
      });

      it("uses the salt the SDK resolved when the flag is on", async () => {
        configService.getFeatureFlag.mockResolvedValue(true);

        const result = await firstValueFrom(sut.getPreloginData$(email));

        expect(result.salt).toBe(sdkSalt);
      });
    });

    // KDF mapping and each pre-login minimum are covered by PasswordPreloginData.fromResponse.
    // These pin that both transports enforce the guard and that a rejection is not cached.
    describe("kdf config", () => {
      it("rejects sub-minimum kdf settings from the API", async () => {
        apiService.getPreloginData.mockResolvedValue(
          new PasswordPreloginResponse({
            KdfSettings: { KdfType: 0, Iterations: PBKDF2KdfConfig.PRELOGIN_ITERATIONS_MIN - 1 },
          }),
        );

        await expect(firstValueFrom(sut.getPreloginData$(email))).rejects.toThrow(
          /PBKDF2 iterations must be at least/,
        );
      });

      it("rejects sub-minimum kdf settings from the SDK", async () => {
        configService.getFeatureFlag.mockResolvedValue(true);
        sdkService.client.auth
          .mockDeep()
          .login.mockDeep()
          .get_password_prelogin.mockResolvedValue({
            kdf: { pBKDF2: { iterations: PBKDF2KdfConfig.PRELOGIN_ITERATIONS_MIN - 1 } },
            salt: sdkSalt,
          });

        await expect(firstValueFrom(sut.getPreloginData$(email))).rejects.toThrow(
          /PBKDF2 iterations must be at least/,
        );
      });

      it("does not cache a rejected fetch, so a retry refetches", async () => {
        apiService.getPreloginData.mockResolvedValueOnce(
          new PasswordPreloginResponse({
            KdfSettings: { KdfType: 0, Iterations: PBKDF2KdfConfig.PRELOGIN_ITERATIONS_MIN - 1 },
            Salt: apiSalt,
          }),
        );
        apiService.getPreloginData.mockResolvedValueOnce(response);

        await expect(firstValueFrom(sut.getPreloginData$(email))).rejects.toThrow(
          /pre-login downgrade attack/,
        );

        expect(await firstValueFrom(sut.getPreloginData$(email))).toEqual(expectedData);
        expect(apiService.getPreloginData).toHaveBeenCalledTimes(2);
      });
    });

    it("returns the same in-flight observable when called again with the same email", async () => {
      let resolveFn!: (v: PasswordPreloginResponse) => void;
      const deferred = new Promise<PasswordPreloginResponse>((res) => (resolveFn = res));
      apiService.getPreloginData.mockReturnValue(deferred);

      const first$ = sut.getPreloginData$(email);
      const second$ = sut.getPreloginData$(email);
      await flushPromises();

      expect(second$).toBe(first$);
      expect(apiService.getPreloginData).toHaveBeenCalledTimes(1);

      resolveFn(response);
      expect(await firstValueFrom(first$)).toEqual(expectedData);
    });

    it("returns the same observable and replays the result when called again after the same email has resolved", async () => {
      const first$ = sut.getPreloginData$(email);
      const firstResult = await firstValueFrom(first$);

      const second$ = sut.getPreloginData$(email);
      const secondResult = await firstValueFrom(second$);

      expect(second$).toBe(first$);
      expect(firstResult).toEqual(expectedData);
      expect(secondResult).toEqual(expectedData);
      expect(apiService.getPreloginData).toHaveBeenCalledTimes(1);
    });

    it("starts a new request when called with a different email while the first is in-flight", async () => {
      let resolveA!: (v: PasswordPreloginResponse) => void;
      const deferredA = new Promise<PasswordPreloginResponse>((res) => (resolveA = res));

      apiService.getPreloginData.mockReturnValueOnce(deferredA);
      apiService.getPreloginData.mockResolvedValueOnce(response);

      const first$ = sut.getPreloginData$(emailA);
      const second$ = sut.getPreloginData$(emailB);
      await flushPromises();

      expect(second$).not.toBe(first$);
      expect(apiService.getPreloginData).toHaveBeenCalledTimes(2);
      expect(await firstValueFrom(second$)).toEqual(expectedDataFor(emailB));

      // The original in-flight observable still resolves correctly
      resolveA(response);
      expect(await firstValueFrom(first$)).toEqual(expectedDataFor(emailA));
    });

    it("starts a new request when called with a different email after the first has resolved", async () => {
      const first$ = sut.getPreloginData$(emailA);
      const firstResult = await firstValueFrom(first$);

      const second$ = sut.getPreloginData$(emailB);
      const secondResult = await firstValueFrom(second$);

      expect(second$).not.toBe(first$);
      expect(firstResult).toEqual(expectedDataFor(emailA));
      expect(secondResult).toEqual(expectedDataFor(emailB));
      expect(apiService.getPreloginData).toHaveBeenCalledTimes(2);
    });

    it("normalizes email before comparing and before sending to the API", async () => {
      const first$ = sut.getPreloginData$("  USER@EXAMPLE.COM  ");
      const second$ = sut.getPreloginData$(email);

      expect(second$).toBe(first$);
      expect(await firstValueFrom(first$)).toEqual(expectedData);
      expect(apiService.getPreloginData).toHaveBeenCalledTimes(1);
      expect(apiService.getPreloginData).toHaveBeenCalledWith(new PasswordPreloginRequest(email));
    });

    it("creates a new request when the previous request for the same email failed", async () => {
      const networkError = new Error("Network error");
      apiService.getPreloginData.mockRejectedValueOnce(networkError);
      apiService.getPreloginData.mockResolvedValueOnce(response);

      // First attempt (e.g. prefetch on Continue click) — fails
      await expect(firstValueFrom(sut.getPreloginData$(email))).rejects.toThrow("Network error");

      // Second attempt (e.g. user retries Submit with the same email) — should make a fresh request
      const result = await firstValueFrom(sut.getPreloginData$(email));

      expect(result).toEqual(expectedData);
      expect(apiService.getPreloginData).toHaveBeenCalledTimes(2);
    });

    it("emits the resolved value to a subscriber that arrives after a fire-and-forget call", async () => {
      // Fire-and-forget: starts the request without subscribing
      void sut.getPreloginData$(email);

      // Late subscriber receives the result via the same observable
      const result = await firstValueFrom(sut.getPreloginData$(email));

      expect(result).toEqual(expectedData);
      expect(apiService.getPreloginData).toHaveBeenCalledTimes(1);
    });
  });

  describe("clearCache", () => {
    it("causes a new request for the same email after clearing", async () => {
      await firstValueFrom(sut.getPreloginData$(email));
      sut.clearCache();
      await firstValueFrom(sut.getPreloginData$(email));

      expect(apiService.getPreloginData).toHaveBeenCalledTimes(2);
    });
  });
});
