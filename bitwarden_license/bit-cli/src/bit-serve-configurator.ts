import * as koaRouter from "@koa/router";

import { OssServeConfigurator } from "@bitwarden/cli/oss-serve-configurator";

import {
  ApproveAllCommand,
  ApproveCommand,
  DenyAllCommand,
  DenyCommand,
  ListCommand,
} from "./admin-console/device-approval";
import { ServiceContainer } from "./service-container";

export class BitServeConfigurator extends OssServeConfigurator {
  constructor(protected override serviceContainer: ServiceContainer) {
    super(serviceContainer);
  }

  override configureRouter(router: koaRouter): void {
    // Register OSS endpoints
    super.configureRouter(router);

    // Register bit endpoints
    this.serveDeviceApprovals(router);
  }

  private serveDeviceApprovals(router: koaRouter) {
    router.get("/device-approval/:organizationId", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }

      const response = await ListCommand.create(this.serviceContainer).run(
        ctx.params.organizationId,
      );
      this.processResponse(ctx.response, response);
      await next();
    });

    router.post("/device-approval/:organizationId/approve-all", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }

      const response = await ApproveAllCommand.create(this.serviceContainer).run(
        ctx.params.organizationId,
      );
      this.processResponse(ctx.response, response);
      await next();
    });

    router.post("/device-approval/:organizationId/approve/:requestId", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }

      const response = await ApproveCommand.create(this.serviceContainer).run(
        ctx.params.organizationId,
        ctx.params.requestId,
      );
      this.processResponse(ctx.response, response);
      await next();
    });

    router.post("/device-approval/:organizationId/deny-all", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }

      const response = await DenyAllCommand.create(this.serviceContainer).run(
        ctx.params.organizationId,
      );
      this.processResponse(ctx.response, response);
      await next();
    });

    router.post("/device-approval/:organizationId/deny/:requestId", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }

      const response = await DenyCommand.create(this.serviceContainer).run(
        ctx.params.organizationId,
        ctx.params.requestId,
      );
      this.processResponse(ctx.response, response);
      await next();
    });
  }
}
