/**
 * include Request in test environment.
 * @jest-environment ../../../../shared/test.environment.ts
 */
import { DUCK_DUCK_GO_FORWARDER } from "../../key-definitions";
import { Forwarders } from "../options/constants";

import { DuckDuckGoForwarder } from "./duck-duck-go";
import { mockApiService, mockI18nService } from "./mocks.jest";

describe("DuckDuckGo Forwarder", () => {
  it("key returns the Duck Duck Go forwarder key", () => {
    const forwarder = new DuckDuckGoForwarder(null, null, null, null, null);

    expect(forwarder.key).toBe(DUCK_DUCK_GO_FORWARDER);
  });

  describe("generate(string | null, SelfHostedApiOptions & EmailDomainOptions)", () => {
    it.each([null, ""])("throws an error if the token is missing (token = %p)", async (token) => {
      const apiService = mockApiService(200, {});
      const i18nService = mockI18nService();

      const forwarder = new DuckDuckGoForwarder(apiService, i18nService, null, null, null);

      await expect(
        async () =>
          await forwarder.generate({
            website: null,
            token,
          }),
      ).rejects.toEqual("forwaderInvalidToken");

      expect(apiService.nativeFetch).not.toHaveBeenCalled();
      expect(i18nService.t).toHaveBeenCalledWith(
        "forwaderInvalidToken",
        Forwarders.DuckDuckGo.name,
      );
    });

    it.each([
      ["jane.doe@duck.com", 201, "jane.doe"],
      ["john.doe@duck.com", 201, "john.doe"],
      ["jane.doe@duck.com", 200, "jane.doe"],
      ["john.doe@duck.com", 200, "john.doe"],
    ])(
      "returns the generated email address (= %p) if the request is successful (status = %p)",
      async (email, status, address) => {
        const apiService = mockApiService(status, { address });
        const i18nService = mockI18nService();

        const forwarder = new DuckDuckGoForwarder(apiService, i18nService, null, null, null);

        const result = await forwarder.generate({
          website: null,
          token: "token",
        });

        expect(result).toEqual(email);
        expect(apiService.nativeFetch).toHaveBeenCalledWith(expect.any(Request));
      },
    );

    it("throws an invalid token error if the request fails with a 401", async () => {
      const apiService = mockApiService(401, {});
      const i18nService = mockI18nService();

      const forwarder = new DuckDuckGoForwarder(apiService, i18nService, null, null, null);

      await expect(
        async () =>
          await forwarder.generate({
            website: null,
            token: "token",
          }),
      ).rejects.toEqual("forwaderInvalidToken");

      expect(apiService.nativeFetch).toHaveBeenCalledWith(expect.any(Request));
      // counting instances is terribly flaky over changes, but jest doesn't have a better way to do this
      expect(i18nService.t).toHaveBeenCalledWith(
        "forwaderInvalidToken",
        Forwarders.DuckDuckGo.name,
      );
    });

    it("throws an unknown error if the request is successful but an address isn't present", async () => {
      const apiService = mockApiService(200, {});
      const i18nService = mockI18nService();

      const forwarder = new DuckDuckGoForwarder(apiService, i18nService, null, null, null);

      await expect(
        async () =>
          await forwarder.generate({
            website: null,
            token: "token",
          }),
      ).rejects.toEqual("forwarderUnknownError");

      expect(apiService.nativeFetch).toHaveBeenCalledWith(expect.any(Request));
      // counting instances is terribly flaky over changes, but jest doesn't have a better way to do this
      expect(i18nService.t).toHaveBeenCalledWith(
        "forwarderUnknownError",
        Forwarders.DuckDuckGo.name,
      );
    });

    it.each([100, 202, 300, 418, 500, 600])(
      "throws an unknown error if the request returns any other status code (= %i)",
      async (statusCode) => {
        const apiService = mockApiService(statusCode, {});
        const i18nService = mockI18nService();

        const forwarder = new DuckDuckGoForwarder(apiService, i18nService, null, null, null);

        await expect(
          async () =>
            await forwarder.generate({
              website: null,
              token: "token",
            }),
        ).rejects.toEqual("forwarderUnknownError");

        expect(apiService.nativeFetch).toHaveBeenCalledWith(expect.any(Request));
        // counting instances is terribly flaky over changes, but jest doesn't have a better way to do this
        expect(i18nService.t).toHaveBeenCalledWith(
          "forwarderUnknownError",
          Forwarders.DuckDuckGo.name,
        );
      },
    );
  });
});
