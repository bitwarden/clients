import { mock } from "jest-mock-extended";

import {
  ApiSettings,
  IntegrationRequest,
  TokenHeader,
} from "@bitwarden/common/tools/integration/rpc";

import { CreateForwardingEmailRpcDef, ForwarderConfiguration } from "../forwarder-configuration";
import { ForwarderContext } from "../forwarder-context";

import { CreateForwardingAddressRpc } from "./create-forwarding-address";

describe("CreateForwardingAddressRpc", () => {
  const createForwardingEmail =
    mock<CreateForwardingEmailRpcDef<ApiSettings, IntegrationRequest>>();
  const requestor = mock<ForwarderConfiguration<ApiSettings>>({
    forwarder: { createForwardingEmail },
  });
  const context = mock<ForwarderContext<ApiSettings>>();

  beforeEach(() => {
    createForwardingEmail.url.mockReturnValue("https://httpbin.org/json");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("toRequest", () => {
    it("constructs a request", () => {
      const builder = new CreateForwardingAddressRpc(requestor, context);

      const result = builder.toRequest({ website: null });

      expect(result.redirect).toEqual("manual");
      expect(result.cache).toEqual("no-store");
      expect(result.method).toEqual("POST");
      expect(result.headers.get("Content-Type")).toEqual("application/json");
      expect(result.headers.get("Accept")).toEqual("application/json");
    });

    it("provides the request and context to the rpc definition functions", () => {
      const builder = new CreateForwardingAddressRpc(requestor, context);
      const request: IntegrationRequest = { website: null };

      builder.toRequest(request);

      expect(requestor.authenticate).toHaveBeenCalledWith(request, context);

      expect(createForwardingEmail.url).toHaveBeenCalledWith(request, context);
      expect(createForwardingEmail.body).toHaveBeenCalledWith(request, context);
    });

    it("stringifies the body", async () => {
      createForwardingEmail.body.mockReturnValue({ foo: 1 });
      const builder = new CreateForwardingAddressRpc(requestor, context);

      const request = builder.toRequest({ website: null });

      // extract the text from the body; it's wild there isn't
      // a more clear way to do this
      const result = await new Response(request.body).text();

      expect(result).toEqual('{"foo":1}');
    });

    it("omits the body", async () => {
      // can't use the mock here because it defines a `body` function
      // on `createForwardingEmail`
      const requestor = {
        authenticate() {
          return undefined as TokenHeader;
        },
        forwarder: {
          createForwardingEmail: {
            url() {
              return "https://httpbin.org/json";
            },
          },
        },
      } as unknown as ForwarderConfiguration<ApiSettings>;

      const builder = new CreateForwardingAddressRpc(requestor, context);

      const result = builder.toRequest({ website: null });

      expect(result.body).toBeNull();
    });
  });

  describe("hasJsonPayload", () => {
    it("forwards the call to the rpc definition with context", () => {
      const builder = new CreateForwardingAddressRpc(requestor, context);
      const response: Response = {} as any;
      createForwardingEmail.hasJsonPayload.mockReturnValue(true);

      const result = builder.hasJsonPayload(response);

      expect(result).toBe(true);
      expect(createForwardingEmail.hasJsonPayload).toHaveBeenCalledWith(response, context);
    });
  });

  describe("processJson", () => {
    it("forwards the call to the rpc definition with context", () => {
      const builder = new CreateForwardingAddressRpc(requestor, context);
      const json = {} as any;
      createForwardingEmail.processJson.mockReturnValue(["foo"]);

      const result = builder.processJson(json);

      expect(result).toEqual(["foo"]);
      expect(createForwardingEmail.processJson).toHaveBeenCalledWith(json, context);
    });
  });
});
