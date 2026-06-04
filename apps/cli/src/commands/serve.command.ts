import http from "node:http";
import net from "node:net";

import { Router } from "@koa/router";
import { OptionValues } from "commander";
import * as koa from "koa";
import type { Context, Next } from "koa";
import * as koaBodyParser from "koa-bodyparser";
import * as koaJson from "koa-json";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { OssServeConfigurator } from "../oss-serve-configurator";
import { ServiceContainer } from "../service-container/service-container";

export function buildServeAllowedHosts(hostname: string, port: number): Set<string> {
  const entries = [
    `localhost:${port}`,
    `127.0.0.1:${port}`,
    `[::1]:${port}`,
    `${hostname}:${port}`,
  ];
  if (port === 80 || port === 443) {
    entries.push("localhost", "127.0.0.1", "[::1]", hostname);
  }
  return new Set(entries.map((entry) => entry.toLowerCase()));
}

function rejectIfHostNotAllowed(
  ctx: Context,
  allowedHosts: ReadonlySet<string>,
  logService: LogService,
): boolean {
  if (allowedHosts.has((ctx.headers.host ?? "").toLowerCase())) {
    return false;
  }
  ctx.status = 403;
  logService.warning(`Blocking request with disallowed Host "${ctx.headers.host ?? "(missing)"}"`);
  return true;
}

function rejectIfOriginPresent(ctx: Context, logService: LogService): boolean {
  if (ctx.headers.origin === undefined) {
    return false;
  }
  ctx.status = 403;
  logService.warning(
    `Blocking request from "${
      Utils.isNullOrEmpty(ctx.headers.origin) ? "(Origin header value missing)" : ctx.headers.origin
    }"`,
  );
  return true;
}

export function buildOriginProtectionMiddleware(opts: {
  protectOrigin: boolean;
  allowedHosts: ReadonlySet<string> | null;
  logService: LogService;
}): (ctx: Context, next: Next) => Promise<void> {
  return async (ctx, next) => {
    if (opts.protectOrigin) {
      // Guards are independent; order does not affect correctness.
      if (
        opts.allowedHosts !== null &&
        rejectIfHostNotAllowed(ctx, opts.allowedHosts, opts.logService)
      ) {
        return;
      }
      if (rejectIfOriginPresent(ctx, opts.logService)) {
        return;
      }
    }
    await next();
  };
}

export class ServeCommand {
  constructor(
    protected serviceContainer: ServiceContainer,
    protected serveConfigurator: OssServeConfigurator,
  ) {}

  async run(options: OptionValues) {
    const protectOrigin = !options.disableOriginProtection;
    const port = Number(options.port) || 8087;
    const hostname = options.hostname || "localhost";
    this.serviceContainer.logService.info(
      `Starting server on ${hostname}:${port} with ${
        protectOrigin ? "origin protection" : "no origin protection"
      }`,
    );

    // `--hostname all` binds every interface, so a LAN client may legitimately
    // reach the server via any local IP.
    const ALLOWED_HOSTS = hostname === "all" ? null : buildServeAllowedHosts(hostname, port);

    const server = new koa();
    const router = new Router();
    process.env.BW_SERVE = "true";
    process.env.BW_NOINTERACTION = "true";

    server
      .use(
        buildOriginProtectionMiddleware({
          protectOrigin,
          allowedHosts: ALLOWED_HOSTS,
          logService: this.serviceContainer.logService,
        }),
      )
      .use(koaBodyParser())
      .use(koaJson({ pretty: false, param: "pretty" }));

    await this.serveConfigurator.configureRouter(router);

    server.use(router.routes()).use(router.allowedMethods());

    if (hostname.startsWith("fd+connected://")) {
      const fd = parseInt(hostname.slice("fd+connected://".length));
      const httpServer = http.createServer(server.callback());
      const socket = new net.Socket({ fd: fd, readable: true, writable: true });
      // allow idle sockets, incomplete handshakes and slow requests
      httpServer.keepAliveTimeout = 0;
      httpServer.headersTimeout = 0;
      httpServer.timeout = 0;
      socket.pause();
      httpServer.emit("connection", socket);
      socket.resume(); // Let the HTTP parser start reading
    } else if (hostname.startsWith("fd+listening://")) {
      const fd = parseInt(hostname.slice("fd+listening://".length));
      server.listen({ fd }, () => {
        this.serviceContainer.logService.info("Listening on " + hostname);
      });
    } else if (hostname.startsWith("unix://")) {
      const socketPath = hostname.slice("unix://".length);
      server.listen(socketPath, () => {
        this.serviceContainer.logService.info("Listening on " + hostname);
      });
    } else {
      server.listen(port, hostname === "all" ? null : hostname, () => {
        this.serviceContainer.logService.info("Listening on " + hostname + ":" + port);
      });
    }
  }
}
