/**
 * include Request in test environment.
 * @jest-environment ../../../../shared/test.environment.ts
 */
import { FORWARD_EMAIL_FORWARDER } from "../../key-definitions";
import { Forwarders } from "../options/constants";

import { ForwardEmailForwarder } from "./forward-email";
import { mockApiService, mockI18nService } from "./mocks.jest";

describe("ForwardEmail Forwarder", () => {
  it("key returns the Forward Email forwarder key", () => {
    const forwarder = new ForwardEmailForwarder(null, null, null, null, null);

    expect(forwarder.key).toBe(FORWARD_EMAIL_FORWARDER);
  });

  describe("generate(string | null, SelfHostedApiOptions & EmailDomainOptions)", () => {
    it.each([null, ""])("throws an error if the token is missing (token = %p)", async (token) => {
      const apiService = mockApiService(200, {});
      const i18nService = mockI18nService();

      const forwarder = new ForwardEmailForwarder(apiService, i18nService, null, null, null);

      await expect(
        async () =>
          await forwarder.generate({
            website: null,
            token,
            domain: "example.com",
          }),
      ).rejects.toEqual("forwaderInvalidToken");

      expect(apiService.nativeFetch).not.toHaveBeenCalled();
      expect(i18nService.t).toHaveBeenCalledWith(
        "forwaderInvalidToken",
        Forwarders.ForwardEmail.name,
      );
    });

    it.each([null, ""])(
      "throws an error if the domain is missing (domain = %p)",
      async (domain) => {
        const apiService = mockApiService(200, {});
        const i18nService = mockI18nService();

        const forwarder = new ForwardEmailForwarder(apiService, i18nService, null, null, null);

        await expect(
          async () =>
            await forwarder.generate({
              website: null,
              token: "token",
              domain,
            }),
        ).rejects.toEqual("forwarderNoDomain");

        expect(apiService.nativeFetch).not.toHaveBeenCalled();
        expect(i18nService.t).toHaveBeenCalledWith(
          "forwarderNoDomain",
          Forwarders.ForwardEmail.name,
        );
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

        const forwarder = new ForwardEmailForwarder(apiService, i18nService, null, null, null);

        await forwarder.generate({
          website,
          token: "token",
          domain: "example.com",
        });

        // counting instances is terribly flaky over changes, but jest doesn't have a better way to do this
        expect(i18nService.t).toHaveBeenCalledWith(translationKey, expectedWebsite);
      },
    );

    it.each([
      ["jane.doe@example.com", 201, { name: "jane.doe", domain: { name: "example.com" } }],
      ["jane.doe@example.com", 201, { name: "jane.doe" }],
      ["john.doe@example.com", 201, { name: "john.doe", domain: { name: "example.com" } }],
      ["john.doe@example.com", 201, { name: "john.doe" }],
      ["jane.doe@example.com", 200, { name: "jane.doe", domain: { name: "example.com" } }],
      ["jane.doe@example.com", 200, { name: "jane.doe" }],
      ["john.doe@example.com", 200, { name: "john.doe", domain: { name: "example.com" } }],
      ["john.doe@example.com", 200, { name: "john.doe" }],
    ])(
      "returns the generated email address (= %p) if the request is successful (status = %p)",
      async (email, status, response) => {
        const apiService = mockApiService(status, response);
        const i18nService = mockI18nService();

        const forwarder = new ForwardEmailForwarder(apiService, i18nService, null, null, null);

        const result = await forwarder.generate({
          website: null,
          token: "token",
          domain: "example.com",
        });

        expect(result).toEqual(email);
        expect(apiService.nativeFetch).toHaveBeenCalledWith(expect.any(Request));
      },
    );

    it("throws an invalid token error if the request fails with a 401", async () => {
      const apiService = mockApiService(401, {});
      const i18nService = mockI18nService();

      const forwarder = new ForwardEmailForwarder(apiService, i18nService, null, null, null);

      await expect(
        async () =>
          await forwarder.generate({
            website: null,
            token: "token",
            domain: "example.com",
          }),
      ).rejects.toEqual("forwaderInvalidToken");

      expect(apiService.nativeFetch).toHaveBeenCalledWith(expect.any(Request));
      // counting instances is terribly flaky over changes, but jest doesn't have a better way to do this
      expect(i18nService.t).toHaveBeenNthCalledWith(
        2,
        "forwaderInvalidToken",
        Forwarders.ForwardEmail.name,
        undefined,
      );
    });

    it("throws an invalid token error with a message if the request fails with a 401 and message", async () => {
      const apiService = mockApiService(401, { message: "A message" });
      const i18nService = mockI18nService();

      const forwarder = new ForwardEmailForwarder(apiService, i18nService, null, null, null);

      await expect(
        async () =>
          await forwarder.generate({
            website: null,
            token: "token",
            domain: "example.com",
          }),
      ).rejects.toEqual("forwaderInvalidTokenWithMessage");

      expect(apiService.nativeFetch).toHaveBeenCalledWith(expect.any(Request));
      // counting instances is terribly flaky over changes, but jest doesn't have a better way to do this
      expect(i18nService.t).toHaveBeenNthCalledWith(
        2,
        "forwaderInvalidTokenWithMessage",
        Forwarders.ForwardEmail.name,
        "A message",
      );
    });

    it.each([{}, null])(
      "throws an unknown error if the request fails and no status (= %p) is provided",
      async (json) => {
        const apiService = mockApiService(500, json);
        const i18nService = mockI18nService();

        const forwarder = new ForwardEmailForwarder(apiService, i18nService, null, null, null);

        await expect(
          async () =>
            await forwarder.generate({
              website: null,
              token: "token",
              domain: "example.com",
            }),
        ).rejects.toEqual("forwarderUnknownError");

        expect(apiService.nativeFetch).toHaveBeenCalledWith(expect.any(Request));
        // counting instances is terribly flaky over changes, but jest doesn't have a better way to do this
        expect(i18nService.t).toHaveBeenNthCalledWith(
          2,
          "forwarderUnknownError",
          Forwarders.ForwardEmail.name,
        );
      },
    );

    it.each([
      [100, "Continue"],
      [202, "Accepted"],
      [300, "Multiple Choices"],
      [418, "I'm a teapot"],
      [500, "Internal Server Error"],
      [600, "Unknown Status"],
    ])(
      "throws an error with the status text if the request returns any other status code (= %i) and a status (= %p) is provided",
      async (statusCode, message) => {
        const apiService = mockApiService(statusCode, { message });
        const i18nService = mockI18nService();

        const forwarder = new ForwardEmailForwarder(apiService, i18nService, null, null, null);

        await expect(
          async () =>
            await forwarder.generate({
              website: null,
              token: "token",
              domain: "example.com",
            }),
        ).rejects.toEqual("forwarderError");

        expect(apiService.nativeFetch).toHaveBeenCalledWith(expect.any(Request));
        // counting instances is terribly flaky over changes, but jest doesn't have a better way to do this
        expect(i18nService.t).toHaveBeenNthCalledWith(
          2,
          "forwarderError",
          Forwarders.ForwardEmail.name,
          message,
        );
      },
    );

    it.each([
      [100, "Continue"],
      [202, "Accepted"],
      [300, "Multiple Choices"],
      [418, "I'm a teapot"],
      [500, "Internal Server Error"],
      [600, "Unknown Status"],
    ])(
      "throws an error with the status text if the request returns any other status code (= %i) and a status (= %p) is provided",
      async (statusCode, error) => {
        const apiService = mockApiService(statusCode, { error });
        const i18nService = mockI18nService();

        const forwarder = new ForwardEmailForwarder(apiService, i18nService, null, null, null);

        await expect(
          async () =>
            await forwarder.generate({
              website: null,
              token: "token",
              domain: "example.com",
            }),
        ).rejects.toEqual("forwarderError");

        expect(apiService.nativeFetch).toHaveBeenCalledWith(expect.any(Request));
        // counting instances is terribly flaky over changes, but jest doesn't have a better way to do this
        expect(i18nService.t).toHaveBeenNthCalledWith(
          2,
          "forwarderError",
          Forwarders.ForwardEmail.name,
          error,
        );
      },
    );
  });
});
