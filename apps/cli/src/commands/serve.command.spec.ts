import { mock } from "jest-mock-extended";
import type { Context, Next } from "koa";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { buildOriginProtectionMiddleware, buildServeAllowedHosts } from "./serve.command";

describe("buildOriginProtectionMiddleware", () => {
  const logService = mock<LogService>();
  const allowedHosts = new Set(["localhost:8087", "127.0.0.1:8087", "[::1]:8087"]);
  const middleware = buildOriginProtectionMiddleware({
    protectOrigin: true,
    allowedHosts,
    logService,
  });

  describe("when protectOrigin is true (default)", () => {
    it("blocks request with a non-empty Origin header (cross-origin fetch)", async () => {
      const ctx = mock<Context>({
        headers: { host: "127.0.0.1:8087", origin: "https://evil.example" },
      });
      const next = jest.fn<Promise<void>, []>();

      await middleware(ctx, next as unknown as Next);

      expect(ctx.status).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("allows request with no Origin header and allowlisted Host", async () => {
      const ctx = mock<Context>({ headers: { host: "127.0.0.1:8087", origin: undefined } });
      const next = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);

      await middleware(ctx, next as unknown as Next);

      expect(next).toHaveBeenCalled();
      expect(ctx.status).not.toBe(403);
    });

    it("blocks DNS-rebound request with disallowed Host and no Origin (THE FIX)", async () => {
      const ctx = mock<Context>({ headers: { host: "evil.example:8087", origin: undefined } });
      const next = jest.fn<Promise<void>, []>();

      await middleware(ctx, next as unknown as Next);

      expect(ctx.status).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("performs case-insensitive Host comparison", async () => {
      const ctx = mock<Context>({ headers: { host: "LOCALHOST:8087", origin: undefined } });
      const next = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);

      await middleware(ctx, next as unknown as Next);

      expect(next).toHaveBeenCalled();
      expect(ctx.status).not.toBe(403);
    });

    it("blocks request with missing Host header (no host key)", async () => {
      const ctx = mock<Context>({ headers: { host: undefined } });
      const next = jest.fn<Promise<void>, []>();

      await middleware(ctx, next as unknown as Next);

      expect(ctx.status).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("when protectOrigin is false (--disable-origin-protection)", () => {
    it("passes through any request regardless of headers", async () => {
      const passThrough = buildOriginProtectionMiddleware({
        protectOrigin: false,
        allowedHosts,
        logService,
      });
      const ctx = mock<Context>({
        headers: { host: "evil.example:8087", origin: "https://evil.example" },
      });
      const next = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);

      await passThrough(ctx, next as unknown as Next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("when allowedHosts is null (--hostname all)", () => {
    const hostAllowlistDisabled = buildOriginProtectionMiddleware({
      protectOrigin: true,
      allowedHosts: null,
      logService,
    });

    it("allows request with arbitrary Host and no Origin (Layer 1 disabled)", async () => {
      const ctx = mock<Context>({ headers: { host: "192.168.1.5:8087", origin: undefined } });
      const next = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);

      await hostAllowlistDisabled(ctx, next as unknown as Next);

      expect(next).toHaveBeenCalled();
      expect(ctx.status).not.toBe(403);
    });

    it("still blocks disallowed Origin (Layer 2 remains active)", async () => {
      const ctx = mock<Context>({
        headers: { host: "192.168.1.5:8087", origin: "https://evil.example" },
      });
      const next = jest.fn<Promise<void>, []>();

      await hostAllowlistDisabled(ctx, next as unknown as Next);

      expect(ctx.status).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});

describe("buildServeAllowedHosts", () => {
  it("includes the configured hostname in the allowlist, normalized to lowercase", () => {
    const hosts = buildServeAllowedHosts("BWApi.MyDomain.COM", 80);
    expect(hosts.has("bwapi.mydomain.com:80")).toBe(true);
    expect(hosts.has("BWApi.MyDomain.COM:80")).toBe(false);
    // Port 80 is the http default; bare-host form must also be present
    expect(hosts.has("bwapi.mydomain.com")).toBe(true);
  });

  it("adds bare-host entries when port is 80 (http default)", () => {
    const hosts = buildServeAllowedHosts("bwapi.example", 80);
    expect(hosts.has("bwapi.example:80")).toBe(true);
    expect(hosts.has("bwapi.example")).toBe(true);
    expect(hosts.has("localhost")).toBe(true);
    expect(hosts.has("127.0.0.1")).toBe(true);
    expect(hosts.has("[::1]")).toBe(true);
  });

  it("adds bare-host entries when port is 443 (https default)", () => {
    const hosts = buildServeAllowedHosts("bwapi.example", 443);
    expect(hosts.has("bwapi.example:443")).toBe(true);
    expect(hosts.has("bwapi.example")).toBe(true);
    expect(hosts.has("localhost")).toBe(true);
    expect(hosts.has("127.0.0.1")).toBe(true);
    expect(hosts.has("[::1]")).toBe(true);
  });

  it("does NOT add bare-host entries for non-default ports", () => {
    const hosts = buildServeAllowedHosts("bwapi.example", 8087);
    expect(hosts.has("bwapi.example:8087")).toBe(true);
    expect(hosts.has("localhost:8087")).toBe(true);
    expect(hosts.has("127.0.0.1:8087")).toBe(true);
    expect(hosts.has("[::1]:8087")).toBe(true);
    expect(hosts.has("bwapi.example")).toBe(false);
    expect(hosts.has("localhost")).toBe(false);
    expect(hosts.has("127.0.0.1")).toBe(false);
    expect(hosts.has("[::1]")).toBe(false);
  });
});
