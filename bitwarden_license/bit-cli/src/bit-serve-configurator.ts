import { Router, RouterContext } from "@koa/router";
import { firstValueFrom } from "rxjs";

import { Response } from "@bitwarden/cli/models/response";
import { OssServeConfigurator } from "@bitwarden/cli/oss-serve-configurator";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import {
  ApproveAllCommand,
  ApproveCommand,
  DenyAllCommand,
  DenyCommand,
  ListCommand,
} from "./admin-console/device-approval";
import { AccessGetCommand } from "./secrets-manager/access/access-get.command";
import { AccessGrantCommand } from "./secrets-manager/access/access-grant.command";
import { AccessRevokeCommand } from "./secrets-manager/access/access-revoke.command";
import { AccessSetCommand } from "./secrets-manager/access/access-set.command";
import { AccessTokenCreateCommand } from "./secrets-manager/access-tokens/access-token-create.command";
import { AccessTokenListCommand } from "./secrets-manager/access-tokens/access-token-list.command";
import { AccessTokenRevokeCommand } from "./secrets-manager/access-tokens/access-token-revoke.command";
import { CountsCommand } from "./secrets-manager/counts/counts.command";
import { EventsCommand } from "./secrets-manager/events/events.command";
import { GranteesListCommand } from "./secrets-manager/grantees/grantees-list.command";
import { MachineAccountCreateCommand } from "./secrets-manager/machine-accounts/machine-account-create.command";
import { MachineAccountDeleteCommand } from "./secrets-manager/machine-accounts/machine-account-delete.command";
import { MachineAccountEditCommand } from "./secrets-manager/machine-accounts/machine-account-edit.command";
import { MachineAccountGetCommand } from "./secrets-manager/machine-accounts/machine-account-get.command";
import { MachineAccountListCommand } from "./secrets-manager/machine-accounts/machine-account-list.command";
import { SmExportCommand } from "./secrets-manager/porting/sm-export.command";
import { SmImportCommand } from "./secrets-manager/porting/sm-import.command";
import { ProjectCreateCommand } from "./secrets-manager/projects/project-create.command";
import { ProjectDeleteCommand } from "./secrets-manager/projects/project-delete.command";
import { ProjectEditCommand } from "./secrets-manager/projects/project-edit.command";
import { ProjectGetCommand } from "./secrets-manager/projects/project-get.command";
import { ProjectListCommand } from "./secrets-manager/projects/project-list.command";
import { SecretCreateCommand } from "./secrets-manager/secrets/secret-create.command";
import { SecretDeleteCommand } from "./secrets-manager/secrets/secret-delete.command";
import { SecretEditCommand } from "./secrets-manager/secrets/secret-edit.command";
import { SecretGetCommand } from "./secrets-manager/secrets/secret-get.command";
import { SecretListCommand } from "./secrets-manager/secrets/secret-list.command";
import { SecretRestoreVersionCommand } from "./secrets-manager/secrets/secret-restore-version.command";
import { SecretVersionsCommand } from "./secrets-manager/secrets/secret-versions.command";
import { TemplateCommand } from "./secrets-manager/templates/template.command";
import { TrashEmptyCommand } from "./secrets-manager/trash/trash-empty.command";
import { TrashListCommand } from "./secrets-manager/trash/trash-list.command";
import { TrashRestoreCommand } from "./secrets-manager/trash/trash-restore.command";
import { SmTrashSelection } from "./secrets-manager/trash/trash-selection";
import { ServiceContainer } from "./service-container";

type SmRouteHandler = (ctx: RouterContext) => Promise<Response>;

export class BitServeConfigurator extends OssServeConfigurator {
  constructor(protected override serviceContainer: ServiceContainer) {
    super(serviceContainer);
  }

  override async configureRouter(router: Router): Promise<void> {
    // Register OSS endpoints
    await super.configureRouter(router);

    // Register bit endpoints
    this.serveDeviceApprovals(router);
    this.serveSecretsManager(router);
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

  private serveSecretsManager(router: Router) {
    const sc = this.serviceContainer;

    router.get(
      "/sm/template/:object",
      this.smRoute(async (ctx) => await TemplateCommand.create().run(ctx.params.object)),
    );

    router.get(
      "/sm/:organizationId/projects",
      this.smRoute(
        async (ctx) => await ProjectListCommand.create(sc).run(ctx.params.organizationId),
      ),
    );
    router.get(
      "/sm/:organizationId/projects/:projectId",
      this.smRoute(
        async (ctx) =>
          await ProjectGetCommand.create(sc).run(ctx.params.organizationId, ctx.params.projectId),
      ),
    );
    router.post(
      "/sm/:organizationId/projects",
      this.smRoute(
        async (ctx) =>
          await ProjectCreateCommand.create(sc).run(ctx.params.organizationId, smBody(ctx)),
      ),
    );
    router.put(
      "/sm/:organizationId/projects/:projectId",
      this.smRoute(
        async (ctx) =>
          await ProjectEditCommand.create(sc).run(
            ctx.params.organizationId,
            ctx.params.projectId,
            smBody(ctx),
          ),
      ),
    );
    router.delete(
      "/sm/:organizationId/projects/:projectId",
      this.smRoute(
        async (ctx) =>
          await ProjectDeleteCommand.create(sc).run(ctx.params.organizationId, [
            ctx.params.projectId,
          ]),
      ),
    );

    router.get(
      "/sm/:organizationId/secrets",
      this.smRoute(
        async (ctx) =>
          await SecretListCommand.create(sc).run(
            ctx.params.organizationId,
            smQuery(ctx, "projectid"),
          ),
      ),
    );
    router.get(
      "/sm/:organizationId/secrets/:secretId",
      this.smRoute(
        async (ctx) =>
          await SecretGetCommand.create(sc).run(ctx.params.organizationId, ctx.params.secretId),
      ),
    );
    router.post(
      "/sm/:organizationId/secrets",
      this.smRoute(
        async (ctx) =>
          await SecretCreateCommand.create(sc).run(ctx.params.organizationId, smBody(ctx)),
      ),
    );
    router.put(
      "/sm/:organizationId/secrets/:secretId",
      this.smRoute(
        async (ctx) =>
          await SecretEditCommand.create(sc).run(
            ctx.params.organizationId,
            ctx.params.secretId,
            smBody(ctx),
          ),
      ),
    );
    router.delete(
      "/sm/:organizationId/secrets/:secretId",
      this.smRoute(
        async (ctx) =>
          await SecretDeleteCommand.create(sc).run(ctx.params.organizationId, [
            ctx.params.secretId,
          ]),
      ),
    );
    router.get(
      "/sm/:organizationId/secrets/:secretId/versions",
      this.smRoute(
        async (ctx) =>
          await SecretVersionsCommand.create(sc).run(
            ctx.params.organizationId,
            ctx.params.secretId,
          ),
      ),
    );
    router.post(
      "/sm/:organizationId/secrets/:secretId/versions/:versionId/restore",
      this.smRoute(
        async (ctx) =>
          await SecretRestoreVersionCommand.create(sc).run(
            ctx.params.organizationId,
            ctx.params.secretId,
            ctx.params.versionId,
          ),
      ),
    );

    router.get(
      "/sm/:organizationId/trash",
      this.smRoute(async (ctx) => await TrashListCommand.create(sc).run(ctx.params.organizationId)),
    );
    router.post(
      "/sm/:organizationId/trash/restore",
      this.smRoute(
        async (ctx) =>
          await TrashRestoreCommand.create(sc).run(
            ctx.params.organizationId,
            smTrashSelection(ctx),
          ),
      ),
    );
    router.post(
      "/sm/:organizationId/trash/empty",
      this.smRoute(
        async (ctx) =>
          await TrashEmptyCommand.create(sc).run(ctx.params.organizationId, smTrashSelection(ctx)),
      ),
    );

    router.get(
      "/sm/:organizationId/machine-accounts",
      this.smRoute(
        async (ctx) => await MachineAccountListCommand.create(sc).run(ctx.params.organizationId),
      ),
    );
    router.get(
      "/sm/:organizationId/machine-accounts/:machineAccountId",
      this.smRoute(
        async (ctx) =>
          await MachineAccountGetCommand.create(sc).run(
            ctx.params.organizationId,
            ctx.params.machineAccountId,
          ),
      ),
    );
    router.post(
      "/sm/:organizationId/machine-accounts",
      this.smRoute(
        async (ctx) =>
          await MachineAccountCreateCommand.create(sc).run(ctx.params.organizationId, smBody(ctx)),
      ),
    );
    router.put(
      "/sm/:organizationId/machine-accounts/:machineAccountId",
      this.smRoute(
        async (ctx) =>
          await MachineAccountEditCommand.create(sc).run(
            ctx.params.organizationId,
            ctx.params.machineAccountId,
            smBody(ctx),
          ),
      ),
    );
    router.delete(
      "/sm/:organizationId/machine-accounts/:machineAccountId",
      this.smRoute(
        async (ctx) =>
          await MachineAccountDeleteCommand.create(sc).run(ctx.params.organizationId, [
            ctx.params.machineAccountId,
          ]),
      ),
    );
    router.get(
      "/sm/:organizationId/machine-accounts/:machineAccountId/events",
      this.smRoute(
        async (ctx) =>
          await EventsCommand.create(sc).run(ctx.params.organizationId, {
            machineAccountId: ctx.params.machineAccountId,
            start: smQuery(ctx, "start"),
            end: smQuery(ctx, "end"),
          }),
      ),
    );

    router.get(
      "/sm/:organizationId/machine-accounts/:machineAccountId/access-tokens",
      this.smRoute(
        async (ctx) =>
          await AccessTokenListCommand.create(sc).run(
            ctx.params.organizationId,
            ctx.params.machineAccountId,
          ),
      ),
    );
    // Unlike the CLI, `expires` is required so that a missing or mistyped field cannot silently
    // create an access token that never expires.
    router.post(
      "/sm/:organizationId/machine-accounts/:machineAccountId/access-tokens",
      this.smRoute(async (ctx) => {
        const body = smBody(ctx);
        if (typeof body.expires !== "string" || body.expires.trim() === "") {
          return Response.badRequest(
            "`expires` is required. Use `never` for an access token that does not expire, or an ISO 8601 date.",
          );
        }
        return await AccessTokenCreateCommand.create(sc).run(
          ctx.params.organizationId,
          ctx.params.machineAccountId,
          { name: smString(body.name), expires: body.expires },
        );
      }),
    );
    router.delete(
      "/sm/:organizationId/machine-accounts/:machineAccountId/access-tokens/:accessTokenId",
      this.smRoute(
        async (ctx) =>
          await AccessTokenRevokeCommand.create(sc).run(
            ctx.params.organizationId,
            ctx.params.machineAccountId,
            [ctx.params.accessTokenId],
          ),
      ),
    );

    router.get(
      "/sm/:organizationId/access/:target/:id",
      this.smRoute(
        async (ctx) =>
          await AccessGetCommand.create(sc).run(
            ctx.params.organizationId,
            ctx.params.target,
            ctx.params.id,
          ),
      ),
    );
    router.put(
      "/sm/:organizationId/access/:target/:id",
      this.smRoute(
        async (ctx) =>
          await AccessSetCommand.create(sc).run(
            ctx.params.organizationId,
            ctx.params.target,
            ctx.params.id,
            smBody(ctx),
          ),
      ),
    );
    router.post(
      "/sm/:organizationId/access/:target/:id/grant",
      this.smRoute(async (ctx) => {
        const body = smBody(ctx);
        return await AccessGrantCommand.create(sc).run(
          ctx.params.organizationId,
          ctx.params.target,
          ctx.params.id,
          smString(body.grantee),
          smString(body.permission),
        );
      }),
    );
    router.post(
      "/sm/:organizationId/access/:target/:id/revoke",
      this.smRoute(
        async (ctx) =>
          await AccessRevokeCommand.create(sc).run(
            ctx.params.organizationId,
            ctx.params.target,
            ctx.params.id,
            smString(smBody(ctx).grantee),
          ),
      ),
    );

    router.get(
      "/sm/:organizationId/grantees/:type",
      this.smRoute(
        async (ctx) =>
          await GranteesListCommand.create(sc).run(ctx.params.organizationId, ctx.params.type),
      ),
    );

    router.get(
      "/sm/:organizationId/counts",
      this.smRoute(
        async (ctx) =>
          await CountsCommand.create(sc).run(ctx.params.organizationId, {
            projectId: smQuery(ctx, "projectid"),
            machineAccountId: smQuery(ctx, "machineaccountid"),
          }),
      ),
    );

    // Requires the master password as `password` in the JSON body. Like /unlock, password file
    // and environment variable sources are not accepted over HTTP.
    router.post(
      "/sm/:organizationId/export",
      this.smRoute(
        async (ctx) =>
          await SmExportCommand.create(sc).run(ctx.params.organizationId, {
            password: smString(smBody(ctx).password),
          }),
      ),
    );
    router.post(
      "/sm/:organizationId/import",
      this.smRoute(
        async (ctx) =>
          await SmImportCommand.create(sc).run(ctx.params.organizationId, {
            data: ctx.request.body,
          }),
      ),
    );
  }

  private smRoute(handler: SmRouteHandler) {
    return async (ctx: RouterContext, next: () => Promise<unknown>) => {
      const enabled = await firstValueFrom(
        this.serviceContainer.configService.getFeatureFlag$(FeatureFlag.SmCli),
      );
      if (!enabled) {
        this.processResponse(
          ctx.response,
          Response.error("This command is temporarily unavailable."),
        );
        await next();
        return;
      }

      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }

      const response = await handler(ctx);
      this.processResponse(ctx.response, response);
      await next();
    };
  }
}

function smBody(ctx: RouterContext): Record<string, unknown> {
  const body: unknown = ctx.request.body;
  return body != null && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

function smQuery(ctx: RouterContext, name: string): string | undefined {
  const value = ctx.request.query[name];
  return Array.isArray(value) ? value[0] : value;
}

function smString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function smTrashSelection(ctx: RouterContext): SmTrashSelection {
  const body = smBody(ctx);
  return {
    secretIds: Array.isArray(body.secretIds)
      ? body.secretIds.filter((id): id is string => typeof id === "string")
      : undefined,
    all: body.all === true || body.all === "true",
  };
}
