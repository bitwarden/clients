import http from "node:http";
import net from "node:net";

import * as koaRouter from "@koa/router";
import { OptionValues } from "commander";
import * as koa from "koa";
import * as koaBodyParser from "koa-bodyparser";
import * as koaJson from "koa-json";

import { Utils } from "@bitwarden/common/platform/misc/utils";

import { OssServeConfigurator } from "../oss-serve-configurator";
import { ServiceContainer } from "../service-container/service-container";

export class ServeCommand {
  constructor(
    protected serviceContainer: ServiceContainer,
    protected serveConfigurator: OssServeConfigurator,
  ) {}

  async run(options: OptionValues) {
    const protectOrigin = !options.disableOriginProtection;
    const port = options.port || 8087;
    const hostname = options.hostname || "localhost";
    this.serviceContainer.logService.info(
      `Starting server on ${hostname}:${port} with ${
        protectOrigin ? "origin protection" : "no origin protection"
      }`,
    );

    const server = new koa();
    const router = new koaRouter();
    process.env.BW_SERVE = "true";
    process.env.BW_NOINTERACTION = "true";

    server
      .use(async (ctx, next) => {
        if (protectOrigin && ctx.headers.origin != undefined) {
          ctx.status = 403;
          this.serviceContainer.logService.warning(
            `Blocking request from "${
              Utils.isNullOrEmpty(ctx.headers.origin)
                ? "(Origin header value missing)"
                : ctx.headers.origin
            }"`,
          );
          return;
        }
        await next();
      })
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
