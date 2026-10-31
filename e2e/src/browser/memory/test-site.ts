import { createServer, Server } from "node:http";
import { AddressInfo } from "node:net";

/**
 * Pages the manifest's `exclude_matches` (`*://*\/*.xml*`) keeps content scripts out of.
 * Served as HTML all the same, they are the same login page without the extension.
 */
const BASELINE_PREFIX = "/baseline.xml";
const LOGIN_PATH = "/login";

function loginPage(prefix: string, frames: number): string {
  const iframes = Array.from(
    { length: frames },
    () => `<iframe src="${prefix}${LOGIN_PATH}?frames=0" width="300" height="200"></iframe>`,
  ).join("\n");

  return `<!doctype html>
<html><head><title>Memory test login</title></head>
<body>
  <form action="#" method="post">
    <input id="username" name="username" type="text" autocomplete="username" />
    <input id="password" name="password" type="password" autocomplete="current-password" />
    <button type="submit">Log in</button>
  </form>
  ${iframes}
</body></html>`;
}

/**
 * Serves a login form with `frames` same-origin iframes, each another login form. The
 * frames share the page's renderer, so one heap reading covers every frame's content
 * scripts (they run with `all_frames`).
 */
export class TestSite {
  private constructor(
    private server: Server,
    readonly origin: string,
  ) {}

  static async start(): Promise<TestSite> {
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://localhost");
      const prefix = url.pathname.startsWith(BASELINE_PREFIX) ? BASELINE_PREFIX : "";
      const frames = Number(url.searchParams.get("frames") ?? 0);

      response.writeHead(200, { "content-type": "text/html" });
      response.end(loginPage(prefix, frames));
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;

    return new TestSite(server, `http://127.0.0.1:${port}`);
  }

  /** The login page, with the extension's content scripts. */
  loginUrl(frames: number): string {
    return `${this.origin}${LOGIN_PATH}?frames=${frames}`;
  }

  /** The same page, without them. */
  baselineUrl(frames: number): string {
    return `${this.origin}${BASELINE_PREFIX}${LOGIN_PATH}?frames=${frames}`;
  }

  async stop() {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }
}
