import { MockProxy, mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { PBKDF2KdfConfig } from "@bitwarden/key-management";

import { DefaultPasswordPreloginService } from "./default-password-prelogin.service";
import { PasswordPreloginApiService } from "./password-prelogin-api.service";
import { PasswordPreloginData } from "./password-prelogin.model";
import { PasswordPreloginRequest } from "./password-prelogin.request";
import { PasswordPreloginResponse } from "./password-prelogin.response";

describe("DefaultPasswordPreloginService", () => {
  let apiService: MockProxy<PasswordPreloginApiService>;
  let sut: DefaultPasswordPreloginService;

  const email = "user@example.com";
  const emailA = "a@example.com";
  const emailB = "b@example.com";

  // PBKDF2 is used as a stand-in throughout; KDF type coverage is in password-prelogin.model.spec.ts.
  const response = new PasswordPreloginResponse({
    Kdf: 0,
    KdfIterations: PBKDF2KdfConfig.ITERATIONS.defaultValue,
  });
  const expectedData = new PasswordPreloginData(
    new PBKDF2KdfConfig(PBKDF2KdfConfig.ITERATIONS.defaultValue),
  );

  beforeEach(() => {
    apiService = mock<PasswordPreloginApiService>();
    sut = new DefaultPasswordPreloginService(apiService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("getPreloginData$", () => {
    it("fetches, maps, and emits prelogin data on first call", async () => {
      apiService.getPreloginData.mockResolvedValue(response);

      const result = await firstValueFrom(sut.getPreloginData$(email));

      expect(result).toEqual(expectedData);
      expect(apiService.getPreloginData).toHaveBeenCalledTimes(1);
      expect(apiService.getPreloginData).toHaveBeenCalledWith(new PasswordPreloginRequest(email));
    });

    it("returns the same in-flight observable when called again with the same email", async () => {
      let resolveFn!: (v: PasswordPreloginResponse) => void;
      const deferred = new Promise<PasswordPreloginResponse>((res) => (resolveFn = res));
      apiService.getPreloginData.mockReturnValue(deferred);

      const first$ = sut.getPreloginData$(email);
      const second$ = sut.getPreloginData$(email);

      expect(second$).toBe(first$);
      expect(apiService.getPreloginData).toHaveBeenCalledTimes(1);

      resolveFn(response);
      expect(await firstValueFrom(first$)).toEqual(expectedData);
    });

    it("returns the same observable and replays the result when called again after the same email has resolved", async () => {
      apiService.getPreloginData.mockResolvedValue(response);

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

      expect(second$).not.toBe(first$);
      expect(apiService.getPreloginData).toHaveBeenCalledTimes(2);
      expect(await firstValueFrom(second$)).toEqual(expectedData);

      // The original in-flight observable still resolves correctly
      resolveA(response);
      expect(await firstValueFrom(first$)).toEqual(expectedData);
    });

    it("starts a new request when called with a different email after the first has resolved", async () => {
      apiService.getPreloginData.mockResolvedValue(response);

      const first$ = sut.getPreloginData$(emailA);
      const firstResult = await firstValueFrom(first$);

      const second$ = sut.getPreloginData$(emailB);
      const secondResult = await firstValueFrom(second$);

      expect(second$).not.toBe(first$);
      expect(firstResult).toEqual(expectedData);
      expect(secondResult).toEqual(expectedData);
      expect(apiService.getPreloginData).toHaveBeenCalledTimes(2);
    });

    it("normalizes email before comparing and before sending to the API", async () => {
      apiService.getPreloginData.mockResolvedValue(response);

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
      apiService.getPreloginData.mockResolvedValue(response);

      // Fire-and-forget: starts the request without subscribing
      void sut.getPreloginData$(email);

      // Late subscriber receives the result via the same observable
      const result = await firstValueFrom(sut.getPreloginData$(email));

      expect(result).toEqual(expectedData);
      expect(apiService.getPreloginData).toHaveBeenCalledTimes(1);
    });
  });

  describe("clearCache", () => {
    it("causes a new API request for the same email after clearing", async () => {
      apiService.getPreloginData.mockResolvedValue(response);

      await firstValueFrom(sut.getPreloginData$(email));
      sut.clearCache();
      await firstValueFrom(sut.getPreloginData$(email));

      expect(apiService.getPreloginData).toHaveBeenCalledTimes(2);
    });
  });
});
