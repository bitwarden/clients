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

    this.serveConfigurator.configureRouter(router);

    server
      .use(router.routes())
      .use(router.allowedMethods())
      .listen(port, hostname === "all" ? null : hostname, () => {
        this.serviceContainer.logService.info("Listening on " + hostname + ":" + port);
      });
  }
}
