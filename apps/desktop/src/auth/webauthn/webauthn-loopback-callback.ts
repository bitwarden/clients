import * as http from "http";
import { AddressInfo } from "net";

/** The path of the connector's callback on the loopback port. */
const CALLBACK_PATH = "/webauthn-callback";

/**
 * Receives the WebAuthn connector's callback on a localhost port, where the app can't receive
 * `bitwarden://` URLs, e.g. in an AppImage on Linux, which doesn't register the scheme.
 *
 * The port is chosen by the system and bound before the browser is opened. The connector request
 * is bound to it, and the response is encrypted to the request's key, so another process that
 * connects can't read it, and a callback that doesn't decrypt leaves the request pending.
 */
export class WebAuthnLoopbackCallback {
  private constructor(
    private server: http.Server,
    /** The port that the connector returns its response to. */
    readonly port: number,
  ) {}

  /**
   * Starts listening on `127.0.0.1`. `deliver` is called with each callback URL, e.g. to deliver it
   * to the browser session waiting for it.
   */
  static async listen(deliver: (url: string) => void): Promise<WebAuthnLoopbackCallback> {
    let port = 0;
    const server = http.createServer((req, res) => {
      const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
      if (req.method !== "GET" || path !== CALLBACK_PATH) {
        res.writeHead(404).end();
        return;
      }
      deliver(`http://127.0.0.1:${port}${req.url}`);
      // No Content: the browser stays on the connector page, which tells the user to return to
      // the app.
      res.writeHead(204).end();
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    port = (server.address() as AddressInfo).port;
    return new WebAuthnLoopbackCallback(server, port);
  }

  /** Stops listening and closes open connections. */
  close(): void {
    this.server.close();
    this.server.closeAllConnections();
  }
}
