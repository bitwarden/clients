/**
 * include Request in test environment.
 * @jest-environment ../../../../shared/test.environment.ts
 */
import { ADDY_IO_FORWARDER } from "../../key-definitions";
import { Forwarders } from "../options/constants";

import { AddyIoForwarder } from "./addy-io";
import { mockApiService, mockI18nService } from "./mocks.jest";

describe("Addy.io Forwarder", () => {
  it("key returns the Addy IO forwarder key", () => {
    const forwarder = new AddyIoForwarder(null, null, null, null, null);

    expect(forwarder.key).toBe(ADDY_IO_FORWARDER);
  });

  describe("generate(string | null, SelfHostedApiOptions & EmailDomainOptions)", () => {
    it.each([null, ""])("throws an error if the token is missing (token = %p)", async (token) => {
      const apiService = mockApiService(200, {});
      const i18nService = mockI18nService();

      const forwarder = new AddyIoForwarder(apiService, i18nService, null, null, null);

      await expect(
        async () =>
          await forwarder.generate({
            website: null,
            token,
            domain: "example.com",
            baseUrl: "https://api.example.com",
          }),
      ).rejects.toEqual("forwaderInvalidToken");

      expect(apiService.nativeFetch).not.toHaveBeenCalled();
      expect(i18nService.t).toHaveBeenCalledWith("forwaderInvalidToken", Forwarders.AddyIo.name);
    });

    it.each([null, ""])(
      "throws an error if the domain is missing (domain = %p)",
      async (domain) => {
        const apiService = mockApiService(200, {});
        const i18nService = mockI18nService();

        const forwarder = new AddyIoForwarder(apiService, i18nService, null, null, null);

        await expect(
          async () =>
            await forwarder.generate({
              website: null,
              token: "token",
              domain,
              baseUrl: "https://api.example.com",
            }),
        ).rejects.toEqual("forwarderNoDomain");

        expect(apiService.nativeFetch).not.toHaveBeenCalled();
        expect(i18nService.t).toHaveBeenCalledWith("forwarderNoDomain", Forwarders.AddyIo.name);
      },
    );

    it.each([null, ""])(
      "throws an error if the baseUrl is missing (baseUrl = %p)",
      async (baseUrl) => {
        const apiService = mockApiService(200, {});
        const i18nService = mockI18nService();

        const forwarder = new AddyIoForwarder(apiService, i18nService, null, null, null);

        await expect(
          async () =>
            await forwarder.generate({
              website: null,
              token: "token",
              domain: "example.com",
              baseUrl,
            }),
        ).rejects.toEqual("forwarderNoUrl");

        expect(apiService.nativeFetch).not.toHaveBeenCalled();
        expect(i18nService.t).toHaveBeenCalledWith("forwarderNoUrl", Forwarders.AddyIo.name);
      },
    );

    it.each([
      ["forwarderGeneratedByWithWebsite", "provided", "bitwarden.com", "bitwarden.com"],
      ["forwarderGeneratedByWithWebsite", "provided", "httpbin.org", "httpbin.org"],
      ["forwarderGeneratedBy", "not provided", null, ""],
      ["forwarderGeneratedBy", "not provided", "", ""],
    ])(
      "describes the website with %p when the website is %s (= %p)",
      async (translationKey, _ignored, website, expectedWebsite) => {
        const apiService = mockApiService(200, {});
        const i18nService = mockI18nService();

        const forwarder = new AddyIoForwarder(apiService, i18nService, null, null, null);

        await forwarder.generate({
          website,
          token: "token",
          domain: "example.com",
          baseUrl: "https://api.example.com",
        });

        // counting instances is terribly flaky over changes, but jest doesn't have a better way to do this
        expect(i18nService.t).toHaveBeenCalledWith(translationKey, expectedWebsite);
      },
    );

    it.each([
      ["jane.doe@example.com", 201],
      ["john.doe@example.com", 201],
      ["jane.doe@example.com", 200],
      ["john.doe@example.com", 200],
    ])(
      "returns the generated email address (= %p) if the request is successful (status = %p)",
      async (email, status) => {
        const apiService = mockApiService(status, { data: { email } });
        const i18nService = mockI18nService();

        const forwarder = new AddyIoForwarder(apiService, i18nService, null, null, null);

        const result = await forwarder.generate({
          website: null,
          token: "token",
          domain: "example.com",
          baseUrl: "https://api.example.com",
        });

        expect(result).toEqual(email);
        expect(apiService.nativeFetch).toHaveBeenCalledWith(expect.any(Request));
      },
    );

    it("throws an invalid token error if the request fails with a 401", async () => {
      const apiService = mockApiService(401, {});
      const i18nService = mockI18nService();

      const forwarder = new AddyIoForwarder(apiService, i18nService, null, null, null);

      await expect(
        async () =>
          await forwarder.generate({
            website: null,
            token: "token",
            domain: "example.com",
            baseUrl: "https://api.example.com",
          }),
      ).rejects.toEqual("forwaderInvalidToken");

      expect(apiService.nativeFetch).toHaveBeenCalledWith(expect.any(Request));
      // counting instances is terribly flaky over changes, but jest doesn't have a better way to do this
      expect(i18nService.t).toHaveBeenNthCalledWith(
        2,
        "forwaderInvalidToken",
        Forwarders.AddyIo.name,
      );
    });

    it("throws an unknown error if the request fails and no status is provided", async () => {
      const apiService = mockApiService(500, {});
      const i18nService = mockI18nService();

      const forwarder = new AddyIoForwarder(apiService, i18nService, null, null, null);

      await expect(
        async () =>
          await forwarder.generate({
            website: null,
            token: "token",
            domain: "example.com",
            baseUrl: "https://api.example.com",
          }),
      ).rejects.toEqual("forwarderUnknownError");

      expect(apiService.nativeFetch).toHaveBeenCalledWith(expect.any(Request));
      // counting instances is terribly flaky over changes, but jest doesn't have a better way to do this
      expect(i18nService.t).toHaveBeenNthCalledWith(
        2,
        "forwarderUnknownError",
        Forwarders.AddyIo.name,
      );
    });

    it.each([
      [100, "Continue"],
      [202, "Accepted"],
      [300, "Multiple Choices"],
      [418, "I'm a teapot"],
      [500, "Internal Server Error"],
      [600, "Unknown Status"],
    ])(
      "throws an error with the status text if the request returns any other status code (= %i) and a status (= %p) is provided",
      async (statusCode, statusText) => {
        const apiService = mockApiService(statusCode, {}, statusText);
        const i18nService = mockI18nService();

        const forwarder = new AddyIoForwarder(apiService, i18nService, null, null, null);

        await expect(
          async () =>
            await forwarder.generate({
              website: null,
              token: "token",
              domain: "example.com",
              baseUrl: "https://api.example.com",
            }),
        ).rejects.toEqual("forwarderError");

        expect(apiService.nativeFetch).toHaveBeenCalledWith(expect.any(Request));
        // counting instances is terribly flaky over changes, but jest doesn't have a better way to do this
        expect(i18nService.t).toHaveBeenNthCalledWith(
          2,
          "forwarderError",
          Forwarders.AddyIo.name,
          statusText,
        );
      },
    );
  });
});
