import { mock } from "jest-mock-extended";

import { ApiSettings, IntegrationRequest } from "@bitwarden/common/tools/integration/rpc";

import { GetAccountIdRpcDef, ForwarderConfiguration } from "../forwarder-configuration";
import { ForwarderContext } from "../forwarder-context";

import { GetAccountIdRpc } from "./get-account-id";

describe("GetAccountIdRpc", () => {
  const getAccountId = mock<GetAccountIdRpcDef<ApiSettings, IntegrationRequest>>();
  const requestor = mock<ForwarderConfiguration<ApiSettings>>({
    forwarder: { getAccountId },
  });
  const context = mock<ForwarderContext<ApiSettings>>();

  beforeEach(() => {
    getAccountId.url.mockReturnValue("https://httpbin.org/json");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("toRequest", () => {
    it("constructs a request", () => {
      const builder = new GetAccountIdRpc(requestor, context);

      const result = builder.toRequest({ website: null });

      expect(result.redirect).toEqual("manual");
      expect(result.cache).toEqual("no-store");
      expect(result.method).toEqual("GET");
      expect(result.headers.get("Content-Type")).toEqual("application/json");
      expect(result.headers.get("Accept")).toEqual("application/json");
    });

    it("provides the request and context to the rpc definition functions", () => {
      const builder = new GetAccountIdRpc(requestor, context);
      const request: IntegrationRequest = { website: null };

      builder.toRequest(request);

      expect(requestor.authenticate).toHaveBeenCalledWith(request, context);

      expect(getAccountId.url).toHaveBeenCalledWith(request, context);
    });

    it("omits the body", async () => {
      const builder = new GetAccountIdRpc(requestor, context);

      const result = builder.toRequest({ website: null });

      expect(result.body).toBeNull();
      expect(getAccountId.body).not.toHaveBeenCalled();
    });
  });

  describe("hasJsonPayload", () => {
    it("forwards the call to the rpc definition with context", () => {
      const builder = new GetAccountIdRpc(requestor, context);
      const response: Response = {} as any;
      getAccountId.hasJsonPayload.mockReturnValue(true);

      const result = builder.hasJsonPayload(response);

      expect(result).toBe(true);
      expect(getAccountId.hasJsonPayload).toHaveBeenCalledWith(response, context);
    });
  });

  describe("processJson", () => {
    it("forwards the call to the rpc definition with context", () => {
      const builder = new GetAccountIdRpc(requestor, context);
      const json = {} as any;
      getAccountId.processJson.mockReturnValue(["foo"]);

      const result = builder.processJson(json);

      expect(result).toEqual(["foo"]);
      expect(getAccountId.processJson).toHaveBeenCalledWith(json, context);
    });
  });
});
