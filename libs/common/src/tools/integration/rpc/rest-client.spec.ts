import { mock } from "jest-mock-extended";

import { ApiService } from "../../../abstractions/api.service";
import { I18nService } from "../../../platform/abstractions/i18n.service";

import { IntegrationRequest } from "./integration-request";
import { RestClient } from "./rest-client";
import { JsonRpc } from "./rpc";

describe("RestClient", () => {
  const expectedRpc = {
    fetchRequest: {} as any,
    json: {},
  } as const;

  const i18n = mock<I18nService>();
  const nativeFetchResponse = mock<Response>({ status: 200 });
  const api = mock<ApiService>();
  const rpc = mock<JsonRpc<IntegrationRequest, object>>({ requestor: { name: "mock" } });

  beforeEach(() => {
    i18n.t.mockImplementation((a) => a);

    api.nativeFetch.mockResolvedValue(nativeFetchResponse);

    rpc.toRequest.mockReturnValue(expectedRpc.fetchRequest);
    rpc.hasJsonPayload.mockReturnValue(true);
    rpc.processJson.mockImplementation((json: any) => [expectedRpc.json]);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("fetchJson", () => {
    it("issues a request", async () => {
      const client = new RestClient(api, i18n);
      const request: IntegrationRequest = { website: null };

      const result = await client.fetchJson(rpc, request);

      expect(result).toBe(expectedRpc.json);
    });

    it("invokes the constructed request", async () => {
      const client = new RestClient(api, i18n);
      const request: IntegrationRequest = { website: null };

      await client.fetchJson(rpc, request);

      expect(api.nativeFetch).toHaveBeenCalledWith(expectedRpc.fetchRequest);
    });

    it.each([
      [401, "forwaderInvalidToken"],
      [403, "forwaderInvalidOperation"],
    ])("throws an invalid token error when HTTP status is %i", async (status, messageKey) => {
      const client = new RestClient(api, i18n);
      const request: IntegrationRequest = { website: null };
      const response = mock<Response>({ status, statusText: null });
      api.nativeFetch.mockResolvedValue(response);

      const result = client.fetchJson(rpc, request);

      await expect(result).rejects.toEqual(messageKey);
    });

    it.each([
      [401, null, null, "forwaderInvalidToken"],
      [401, undefined, undefined, "forwaderInvalidToken"],
      [401, undefined, null, "forwaderInvalidToken"],
      [403, null, null, "forwaderInvalidOperation"],
      [403, undefined, undefined, "forwaderInvalidOperation"],
      [403, undefined, null, "forwaderInvalidOperation"],
    ])(
      "throws an invalid token error when HTTP status is %i, message is %p, and error is %p",
      async (status, message, error, messageKey) => {
        const client = new RestClient(api, i18n);
        const request: IntegrationRequest = { website: null };
        const response = mock<Response>({
          status,
          text: () => Promise.resolve(JSON.stringify({ message, error })),
        });
        api.nativeFetch.mockResolvedValue(response);

        const result = client.fetchJson(rpc, request);

        await expect(result).rejects.toEqual(messageKey);
      },
    );

    it.each([
      [401, "message", "forwaderInvalidTokenWithMessage"],
      [403, "message", "forwaderInvalidOperationWithMessage"],
      [401, "error", "forwaderInvalidTokenWithMessage"],
      [403, "error", "forwaderInvalidOperationWithMessage"],
    ])(
      "throws an invalid token detailed error when HTTP status is %i and the payload has a %s",
      async (status, property, messageKey) => {
        const client = new RestClient(api, i18n);
        const request: IntegrationRequest = { website: null };
        const response = mock<Response>({
          status,
          text: () => Promise.resolve(`{ "${property}": "expected message" }`),
        });
        api.nativeFetch.mockResolvedValue(response);

        const result = client.fetchJson(rpc, request);

        await expect(result).rejects.toEqual(messageKey);
        expect(i18n.t).toHaveBeenCalledWith(messageKey, "mock", "expected message");
      },
    );

    it.each([
      [401, "forwaderInvalidTokenWithMessage"],
      [403, "forwaderInvalidOperationWithMessage"],
    ])(
      "throws an invalid token detailed error when HTTP status is %i and the payload has a %s",
      async (status, messageKey) => {
        const client = new RestClient(api, i18n);
        const request: IntegrationRequest = { website: null };
        const response = mock<Response>({
          status,
          text: () =>
            Promise.resolve(`{ "error": "that happened", "message": "expected message" }`),
        });
        api.nativeFetch.mockResolvedValue(response);

        const result = client.fetchJson(rpc, request);

        await expect(result).rejects.toEqual(messageKey);
        expect(i18n.t).toHaveBeenCalledWith(messageKey, "mock", "that happened: expected message");
      },
    );

    it.each([[429], [500], [501]])(
      "throws a forwarder error when HTTP status is %i",
      async (status) => {
        const client = new RestClient(api, i18n);
        const request: IntegrationRequest = { website: null };
        const response = mock<Response>({ status, statusText: null });
        api.nativeFetch.mockResolvedValue(response);

        const result = client.fetchJson(rpc, request);

        await expect(result).rejects.toEqual("forwarderUnknownError");
        expect(i18n.t).toHaveBeenCalledWith("forwarderUnknownError", "mock", undefined);
      },
    );

    it.each([[429], [500], [501]])(
      "throws a forwarder error when HTTP status is %i and the body is empty",
      async (status) => {
        const client = new RestClient(api, i18n);
        const request: IntegrationRequest = { website: null };
        const response = mock<Response>({
          status,
          statusText: null,
          text: () => Promise.resolve(""),
        });
        api.nativeFetch.mockResolvedValue(response);

        const result = client.fetchJson(rpc, request);

        await expect(result).rejects.toEqual("forwarderUnknownError");
        expect(i18n.t).toHaveBeenCalledWith("forwarderUnknownError", "mock", undefined);
      },
    );

    it.each([[429], [500], [501]])(
      "throws a forwarder error with the status text when HTTP status is %i",
      async (status) => {
        const client = new RestClient(api, i18n);
        const request: IntegrationRequest = { website: null };
        const response = mock<Response>({ status, statusText: "expectedResult" });
        api.nativeFetch.mockResolvedValue(response);

        const result = client.fetchJson(rpc, request);

        await expect(result).rejects.toEqual("forwarderError");
        expect(i18n.t).toHaveBeenCalledWith("forwarderError", "mock", "expectedResult");
      },
    );

    it.each([
      [429, "message"],
      [500, "message"],
      [500, "message"],
      [429, "error"],
      [501, "error"],
      [501, "error"],
    ])(
      "throws a detailed forwarder error when HTTP status is %i and the payload has a %s",
      async (status, property) => {
        const client = new RestClient(api, i18n);
        const request: IntegrationRequest = { website: null };
        const response = mock<Response>({
          status,
          text: () => Promise.resolve(`{ "${property}": "expected message" }`),
        });
        api.nativeFetch.mockResolvedValue(response);

        const result = client.fetchJson(rpc, request);

        await expect(result).rejects.toEqual("forwarderError");
        expect(i18n.t).toHaveBeenCalledWith("forwarderError", "mock", "expected message");
      },
    );

    it.each([[429], [500], [500]])(
      "throws a detailed forwarder error when HTTP status is %i and the payload is a string",
      async (status) => {
        const client = new RestClient(api, i18n);
        const request: IntegrationRequest = { website: null };
        const response = mock<Response>({
          status,
          text: () => Promise.resolve('"expected message"'),
        });
        api.nativeFetch.mockResolvedValue(response);

        const result = client.fetchJson(rpc, request);

        await expect(result).rejects.toEqual("forwarderError");
        expect(i18n.t).toHaveBeenCalledWith("forwarderError", "mock", "expected message");
      },
    );

    it.each([[429], [500], [500]])(
      "throws an unknown forwarder error when HTTP status is %i and the payload could contain an html tag",
      async (status) => {
        const client = new RestClient(api, i18n);
        const request: IntegrationRequest = { website: null };
        const response = mock<Response>({
          status,
          statusText: null,
          text: () => Promise.resolve("<head>"),
        });
        api.nativeFetch.mockResolvedValue(response);

        const result = client.fetchJson(rpc, request);

        await expect(result).rejects.toEqual("forwarderUnknownError");
        expect(i18n.t).toHaveBeenCalledWith("forwarderUnknownError", "mock", undefined);
      },
    );

    it.each([[429], [500], [500]])(
      "throws a unknown forwarder error when HTTP status is %i and the payload is malformed",
      async (status) => {
        const client = new RestClient(api, i18n);
        const request: IntegrationRequest = { website: null };
        const response = mock<Response>({
          status,
          text: () => Promise.resolve(`{ foo: "not json" }`),
        });
        api.nativeFetch.mockResolvedValue(response);

        const result = client.fetchJson(rpc, request);

        await expect(result).rejects.toEqual("forwarderUnknownError");
        expect(i18n.t).toHaveBeenCalledWith("forwarderUnknownError", "mock", undefined);
      },
    );

    it("outputs an error if there's no json payload", async () => {
      const client = new RestClient(api, i18n);
      rpc.hasJsonPayload.mockReturnValue(false);
      const request: IntegrationRequest = { website: null };

      const result = client.fetchJson(rpc, request);

      await expect(result).rejects.toEqual("forwarderUnknownError");
    });

    it("processes an ok JSON payload", async () => {
      const client = new RestClient(api, i18n);
      rpc.processJson.mockReturnValue([{ foo: true }]);
      const request: IntegrationRequest = { website: null };

      const result = client.fetchJson(rpc, request);

      await expect(result).resolves.toEqual({ foo: true });
    });

    it("processes an erroneous JSON payload", async () => {
      const client = new RestClient(api, i18n);
      rpc.processJson.mockReturnValue([undefined, "expected message"]);
      const request: IntegrationRequest = { website: null };

      const result = client.fetchJson(rpc, request);

      await expect(result).rejects.toEqual("forwarderError");
      expect(i18n.t).toHaveBeenCalledWith("forwarderError", "mock", "expected message");
    });
  });
});
