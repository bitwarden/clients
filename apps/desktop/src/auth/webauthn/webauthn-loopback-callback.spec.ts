import * as http from "http";

import { WebAuthnLoopbackCallback } from "./webauthn-loopback-callback";

describe("WebAuthnLoopbackCallback", () => {
  let deliver: jest.Mock;
  let callback: WebAuthnLoopbackCallback;

  beforeEach(async () => {
    deliver = jest.fn();
    callback = await WebAuthnLoopbackCallback.listen(deliver);
  });

  afterEach(() => {
    callback.close();
  });

  function request(path: string, method = "GET"): Promise<number | undefined> {
    return new Promise((resolve, reject) => {
      http
        .request({ host: "127.0.0.1", port: callback.port, path, method }, (res) => {
          res.resume();
          resolve(res.statusCode);
        })
        .on("error", reject)
        .end();
    });
  }

  it("listens on a port chosen by the system", () => {
    expect(callback.port).toBeGreaterThan(0);
  });

  it("delivers the callback URL, and leaves the browser on the connector page", async () => {
    await expect(request("/webauthn-callback?state=abc&response=def")).resolves.toBe(204);

    expect(deliver).toHaveBeenCalledWith(
      `http://127.0.0.1:${callback.port}/webauthn-callback?state=abc&response=def`,
    );
  });

  it.each([
    ["/other?state=abc", "GET"],
    ["/webauthn-callback?state=abc", "POST"],
  ])("ignores %s with %s", async (path, method) => {
    await expect(request(path, method)).resolves.toBe(404);

    expect(deliver).not.toHaveBeenCalled();
  });

  it("stops listening when closed", async () => {
    callback.close();

    await expect(request("/webauthn-callback?state=abc")).rejects.toThrow();
  });
});
