import { Router } from "@koa/router";

import { OssServeConfigurator } from "@bitwarden/cli/oss-serve-configurator";

import {
  ApproveAllCommand,
  ApproveCommand,
  DenyAllCommand,
  DenyCommand,
  ListCommand,
} from "./admin-console/device-approval";
import { registerServeRoutes as registerApprovalsServeRoutes } from "./pam/approvals/serve";
import { registerServeRoutes as registerConnectorsServeRoutes } from "./pam/connectors/serve";
import { registerServeRoutes as registerLeasesServeRoutes } from "./pam/leases/serve";
import { registerServeRoutes as registerRequestsServeRoutes } from "./pam/requests/serve";
import { registerServeRoutes as registerRotationServeRoutes } from "./pam/rotation/serve";
import { registerServeRoutes as registerRulesServeRoutes } from "./pam/rules/serve";
import { registerServeRoutes as registerStatusServeRoutes } from "./pam/status/serve";
import { registerServeRoutes as registerTargetsServeRoutes } from "./pam/targets/serve";
import { ServiceContainer } from "./service-container";

export class BitServeConfigurator extends OssServeConfigurator {
  constructor(protected override serviceContainer: ServiceContainer) {
    super(serviceContainer);
  }

  override async configureRouter(router: Router): Promise<void> {
    // Register OSS endpoints
    await super.configureRouter(router);

    // Register bit endpoints
    this.serveDeviceApprovals(router);
    this.servePam(router);
  }

  /**
   * Registers the `/pam` routes of every group, under the policy in `pam/README.md`. Each group
   * fills in only its own `serve.ts`, so this list is the one shared edit a new group needs.
   */
  private servePam(router: Router) {
    registerRequestsServeRoutes(router, this.serviceContainer);
    registerLeasesServeRoutes(router, this.serviceContainer);
    registerApprovalsServeRoutes(router, this.serviceContainer);
    registerRulesServeRoutes(router, this.serviceContainer);
    registerConnectorsServeRoutes(router, this.serviceContainer);
    registerTargetsServeRoutes(router, this.serviceContainer);
    registerRotationServeRoutes(router, this.serviceContainer);
    registerStatusServeRoutes(router, this.serviceContainer);
  }

  private serveDeviceApprovals(router: Router) {
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
