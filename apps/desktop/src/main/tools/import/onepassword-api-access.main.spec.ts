import { OnHeadersReceivedListenerDetails, Session } from "electron";

import { allowOnePasswordApiAccess } from "./onepassword-api-access.main";

describe("allowOnePasswordApiAccess", () => {
  let onHeadersReceived: jest.Mock;

  beforeEach(() => {
    onHeadersReceived = jest.fn();
    allowOnePasswordApiAccess({ webRequest: { onHeadersReceived } } as unknown as Session);
  });

  /** Runs the registered listener over a response and returns the headers it answered with. */
  function rewrite(responseHeaders?: Record<string, string[]>): Record<string, string[]> {
    const listener = onHeadersReceived.mock.calls[0][1];
    const callback = jest.fn();
    listener({ responseHeaders } as OnHeadersReceivedListenerDetails, callback);
    return callback.mock.calls[0][0].responseHeaders;
  }

  it("only intercepts 1Password's API", () => {
    expect(onHeadersReceived).toHaveBeenCalledWith(
      {
        urls: [
          "https://*.1password.com/api/*",
          "https://*.1password.eu/api/*",
          "https://*.1password.ca/api/*",
        ],
      },
      expect.any(Function),
    );
  });

  it("allows any origin and keeps the other headers", () => {
    expect(
      rewrite({
        "content-type": ["application/json"],
        "access-control-allow-headers": ["X-AgileBits-Client, X-AgileBits-MAC"],
      }),
    ).toEqual({
      "content-type": ["application/json"],
      "access-control-allow-headers": ["X-AgileBits-Client, X-AgileBits-MAC"],
      "access-control-allow-origin": ["*"],
    });
  });

  it("replaces an origin 1Password allowed itself, whatever its case", () => {
    expect(rewrite({ "Access-Control-Allow-Origin": ["https://my.1password.com"] })).toEqual({
      "access-control-allow-origin": ["*"],
    });
  });

  it("answers a response that came without headers", () => {
    expect(rewrite()).toEqual({ "access-control-allow-origin": ["*"] });
  });
});
