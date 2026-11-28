import { createServer, Server } from "http";
import { AddressInfo } from "net";

import { mock } from "jest-mock-extended";

import { NodeApiService } from "./node-api.service";

describe("NodeApiService proxy routing", () => {
  const originalEnv = process.env;
  let destination: Server;
  let proxy: Server;
  let destinationUrl: string;
  let proxyUrl: string;
  let destinationRequests: number;
  let proxyRequests: number;

  const nativeFetch = (url: string) =>
    NodeApiService.prototype.nativeFetch.call(
      mock<NodeApiService>(),
      new Request(url, { signal: AbortSignal.timeout(2000) }),
    );

  beforeAll(async () => {
    destination = createServer((request, response) => {
      destinationRequests++;
      if (request.url === "/redirect") {
        response.writeHead(302, { Location: "http://vault.example/target" });
      } else {
        response.writeHead(200);
      }
      response.end("destination");
    });
    proxy = createServer();
    proxy.on("connect", (_request, socket) => {
      proxyRequests++;
      socket.end("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n", () => socket.destroy());
    });
    await Promise.all([
      new Promise<void>((resolve) => destination.listen(0, "127.0.0.1", resolve)),
      new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve)),
    ]);
    destinationUrl = `http://127.0.0.1:${(destination.address() as AddressInfo).port}`;
    proxyUrl = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`;
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
    for (const key of Object.keys(process.env)) {
      if (key.toLowerCase().endsWith("_proxy")) {
        delete process.env[key];
      }
    }
    destinationRequests = 0;
    proxyRequests = 0;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  afterAll(async () => {
    destination.closeAllConnections();
    proxy.closeAllConnections();
    await Promise.all([
      new Promise<void>((resolve) => destination.close(() => resolve())),
      new Promise<void>((resolve) => proxy.close(() => resolve())),
    ]);
  });

  it("connects directly when no proxy is configured", async () => {
    const response = await nativeFetch(destinationUrl);

    expect(await response.text()).toBe("destination");
    expect(destinationRequests).toBe(1);
    expect(proxyRequests).toBe(0);
  });

  it.each(["http_proxy", "HTTP_PROXY", "all_proxy", "ALL_PROXY"])(
    "uses the proxy configured by %s",
    async (variable) => {
      process.env[variable] = proxyUrl;

      const response = await nativeFetch(destinationUrl);

      expect(response.status).toBe(403);
      expect(destinationRequests).toBe(0);
      expect(proxyRequests).toBe(1);
    },
  );

  it.each(["no_proxy", "NO_PROXY"])("bypasses the proxy for %s", async (variable) => {
    process.env.http_proxy = proxyUrl;
    process.env.https_proxy = proxyUrl;
    process.env[variable] = "127.0.0.1";

    const response = await nativeFetch(destinationUrl);

    expect(await response.text()).toBe("destination");
    expect(destinationRequests).toBe(1);
    expect(proxyRequests).toBe(0);
  });

  it.each(["*", "elsewhere.example, 127.0.0.1", ".0.0.1", "*.0.0.1"])(
    "bypasses the proxy for the exclusion %s",
    async (exclusion) => {
      process.env.http_proxy = proxyUrl;
      process.env.no_proxy = exclusion;

      const response = await nativeFetch(destinationUrl);

      expect(await response.text()).toBe("destination");
      expect(destinationRequests).toBe(1);
      expect(proxyRequests).toBe(0);
    },
  );

  it.each(["elsewhere.example", "0.0.1", "127.0.0.1:1"])(
    "keeps using the proxy for a nonmatching exclusion %s",
    async (exclusion) => {
      process.env.http_proxy = proxyUrl;
      process.env.no_proxy = exclusion;

      const response = await nativeFetch(destinationUrl);

      expect(response.status).toBe(403);
      expect(destinationRequests).toBe(0);
      expect(proxyRequests).toBe(1);
    },
  );

  it("bypasses a matching host and port", async () => {
    process.env.http_proxy = proxyUrl;
    process.env.no_proxy = new URL(destinationUrl).host;

    const response = await nativeFetch(destinationUrl);

    expect(await response.text()).toBe("destination");
    expect(destinationRequests).toBe(1);
    expect(proxyRequests).toBe(0);
  });

  it("prefers lowercase variables over uppercase variables", async () => {
    process.env.http_proxy = proxyUrl;
    process.env.HTTP_PROXY = "http://127.0.0.1:1";
    process.env.no_proxy = "elsewhere.example";
    process.env.NO_PROXY = "127.0.0.1";

    const response = await nativeFetch(destinationUrl);

    expect(response.status).toBe(403);
    expect(proxyRequests).toBe(1);
    expect(destinationRequests).toBe(0);
  });

  it("does not use https_proxy for an HTTP destination", async () => {
    process.env.https_proxy = "http://127.0.0.1:1";

    const response = await nativeFetch(destinationUrl);

    expect(await response.text()).toBe("destination");
    expect(destinationRequests).toBe(1);
  });

  it.each(["https_proxy", "HTTPS_PROXY"])("uses %s for an HTTPS destination", async (variable) => {
    process.env[variable] = proxyUrl;
    process.env.http_proxy = "http://127.0.0.1:1";

    const response = await nativeFetch("https://vault.example");

    expect(response.status).toBe(403);
    expect(proxyRequests).toBe(1);
    expect(destinationRequests).toBe(0);
  });

  it("rechecks exclusions when a redirect changes the destination", async () => {
    process.env.http_proxy = proxyUrl;
    process.env.no_proxy = "127.0.0.1";
    const response = await nativeFetch(`${destinationUrl}/redirect`);

    expect(response.status).toBe(403);
    expect(destinationRequests).toBe(1);
    expect(proxyRequests).toBe(1);
  });

  it("does not retain a proxy when a request is retried with a matching exclusion", async () => {
    process.env.http_proxy = proxyUrl;
    const request = new Request(destinationUrl, { signal: AbortSignal.timeout(2000) });
    const service = mock<NodeApiService>();
    const proxied = await NodeApiService.prototype.nativeFetch.call(service, request);
    expect(proxied.status).toBe(403);

    process.env.no_proxy = "127.0.0.1";
    const direct = await NodeApiService.prototype.nativeFetch.call(service, request);

    expect(await direct.text()).toBe("destination");
    expect(destinationRequests).toBe(1);
    expect(proxyRequests).toBe(1);
  });
});
