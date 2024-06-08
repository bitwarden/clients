import * as koaMulter from "@koa/multer";
import * as koaRouter from "@koa/router";
import { OptionValues } from "commander";
import * as koa from "koa";
import * as koaBodyParser from "koa-bodyparser";
import * as koaJson from "koa-json";

import { Utils } from "@bitwarden/common/platform/misc/utils";

import { ConfirmCommand } from "../admin-console/commands/confirm.command";
import { ShareCommand } from "../admin-console/commands/share.command";
import { LockCommand } from "../auth/commands/lock.command";
import { UnlockCommand } from "../auth/commands/unlock.command";
import { Response } from "../models/response";
import { FileResponse } from "../models/response/file.response";
import { ServiceContainer } from "../service-container";
import { GenerateCommand } from "../tools/generate.command";
import {
  SendEditCommand,
  SendCreateCommand,
  SendDeleteCommand,
  SendGetCommand,
  SendListCommand,
  SendRemovePasswordCommand,
} from "../tools/send";
import { CreateCommand } from "../vault/create.command";
import { DeleteCommand } from "../vault/delete.command";
import { SyncCommand } from "../vault/sync.command";

import { EditCommand } from "./edit.command";
import { GetCommand } from "./get.command";
import { ListCommand } from "./list.command";
import { RestoreCommand } from "./restore.command";
import { StatusCommand } from "./status.command";
import { readFileSync, existsSync } from "fs";

export class ServeCommand {
  private listCommand: ListCommand;
  private getCommand: GetCommand;
  private createCommand: CreateCommand;
  private editCommand: EditCommand;
  private generateCommand: GenerateCommand;
  private shareCommand: ShareCommand;
  private statusCommand: StatusCommand;
  private syncCommand: SyncCommand;
  private deleteCommand: DeleteCommand;
  private confirmCommand: ConfirmCommand;
  private restoreCommand: RestoreCommand;
  private lockCommand: LockCommand;
  private unlockCommand: UnlockCommand;

  private sendCreateCommand: SendCreateCommand;
  private sendDeleteCommand: SendDeleteCommand;
  private sendEditCommand: SendEditCommand;
  private sendGetCommand: SendGetCommand;
  private sendListCommand: SendListCommand;
  private sendRemovePasswordCommand: SendRemovePasswordCommand;

  constructor(protected serviceContainer: ServiceContainer) {
    this.getCommand = new GetCommand(
      this.serviceContainer.cipherService,
      this.serviceContainer.folderService,
      this.serviceContainer.collectionService,
      this.serviceContainer.totpService,
      this.serviceContainer.auditService,
      this.serviceContainer.cryptoService,
      this.serviceContainer.stateService,
      this.serviceContainer.searchService,
      this.serviceContainer.apiService,
      this.serviceContainer.organizationService,
      this.serviceContainer.eventCollectionService,
      this.serviceContainer.billingAccountProfileStateService,
    );
    this.listCommand = new ListCommand(
      this.serviceContainer.cipherService,
      this.serviceContainer.folderService,
      this.serviceContainer.collectionService,
      this.serviceContainer.organizationService,
      this.serviceContainer.searchService,
      this.serviceContainer.organizationUserService,
      this.serviceContainer.apiService,
      this.serviceContainer.eventCollectionService,
    );
    this.createCommand = new CreateCommand(
      this.serviceContainer.cipherService,
      this.serviceContainer.folderService,
      this.serviceContainer.cryptoService,
      this.serviceContainer.apiService,
      this.serviceContainer.folderApiService,
      this.serviceContainer.billingAccountProfileStateService,
      this.serviceContainer.organizationService,
    );
    this.editCommand = new EditCommand(
      this.serviceContainer.cipherService,
      this.serviceContainer.folderService,
      this.serviceContainer.cryptoService,
      this.serviceContainer.apiService,
      this.serviceContainer.folderApiService,
    );
    this.generateCommand = new GenerateCommand(
      this.serviceContainer.passwordGenerationService,
      this.serviceContainer.stateService,
    );
    this.syncCommand = new SyncCommand(this.serviceContainer.syncService);
    this.statusCommand = new StatusCommand(
      this.serviceContainer.environmentService,
      this.serviceContainer.syncService,
      this.serviceContainer.accountService,
      this.serviceContainer.authService,
    );
    this.deleteCommand = new DeleteCommand(
      this.serviceContainer.cipherService,
      this.serviceContainer.folderService,
      this.serviceContainer.apiService,
      this.serviceContainer.folderApiService,
      this.serviceContainer.billingAccountProfileStateService,
    );
    this.confirmCommand = new ConfirmCommand(
      this.serviceContainer.apiService,
      this.serviceContainer.cryptoService,
      this.serviceContainer.organizationUserService,
    );
    this.restoreCommand = new RestoreCommand(this.serviceContainer.cipherService);
    this.shareCommand = new ShareCommand(this.serviceContainer.cipherService);
    this.lockCommand = new LockCommand(this.serviceContainer.vaultTimeoutService);
    this.unlockCommand = new UnlockCommand(
      this.serviceContainer.accountService,
      this.serviceContainer.masterPasswordService,
      this.serviceContainer.cryptoService,
      this.serviceContainer.stateService,
      this.serviceContainer.cryptoFunctionService,
      this.serviceContainer.apiService,
      this.serviceContainer.logService,
      this.serviceContainer.keyConnectorService,
      this.serviceContainer.environmentService,
      this.serviceContainer.syncService,
      this.serviceContainer.organizationApiService,
      async () => await this.serviceContainer.logout(),
      this.serviceContainer.kdfConfigService,
    );

    this.sendCreateCommand = new SendCreateCommand(
      this.serviceContainer.sendService,
      this.serviceContainer.environmentService,
      this.serviceContainer.sendApiService,
      this.serviceContainer.billingAccountProfileStateService,
    );
    this.sendDeleteCommand = new SendDeleteCommand(
      this.serviceContainer.sendService,
      this.serviceContainer.sendApiService,
    );
    this.sendGetCommand = new SendGetCommand(
      this.serviceContainer.sendService,
      this.serviceContainer.environmentService,
      this.serviceContainer.searchService,
      this.serviceContainer.cryptoService,
    );
    this.sendEditCommand = new SendEditCommand(
      this.serviceContainer.sendService,
      this.sendGetCommand,
      this.serviceContainer.sendApiService,
      this.serviceContainer.billingAccountProfileStateService,
    );
    this.sendListCommand = new SendListCommand(
      this.serviceContainer.sendService,
      this.serviceContainer.environmentService,
      this.serviceContainer.searchService,
    );
    this.sendRemovePasswordCommand = new SendRemovePasswordCommand(
      this.serviceContainer.sendService,
      this.serviceContainer.sendApiService,
      this.serviceContainer.environmentService,
    );
  }

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

    const authTokenEnabled = !options.disableAuth;

    var useToken = null;
    if(options.authToken != null && options.authToken.length > 0) {
      useToken = options.authToken;
    }
    if(options.authTokenFile != null && options.authTokenFile.length > 0) {
      if(!existsSync(options.authTokenFile)) {
        this.main.logService.error("Auth token file does not exist.");
        return;
      }
      useToken = readFileSync(options.authTokenFile, 'utf8').trim();
    }
    if(options.authTokenEnv != null && options.authTokenEnv.length > 0) {
      useToken = process.env[options.authTokenEnv];
    }

    const authToken = useToken || process.env.BW_SERVE_AUTH_TOKEN;
    if(authTokenEnabled && (authToken == null || authToken.length == 0)) {
      this.main.logService.error("No auth token provided. Please deactivate auth explicitly or provide an auth token using --auth-token, --auth-token-file, --auth-token-env or BW_SERVE_AUTH_TOKEN environment variable.");
      return;
    }

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
      .use(async (ctx, next) => {
        if(!authTokenEnabled) {
          await next();
          return;
        }

        if (ctx.request.headers.authorization == null || ctx.request.headers.authorization.indexOf("Bearer " + authToken) != 0) {
          ctx.status = 403;
          this.main.logService.warning(
            `Blocking request from as token is invalid or missing.`,
          );
          return;
        }
        await next();
      })
      .use(koaBodyParser())
      .use(koaJson({ pretty: false, param: "pretty" }));

    router.get("/generate", async (ctx, next) => {
      const response = await this.generateCommand.run(ctx.request.query);
      this.processResponse(ctx.response, response);
      await next();
    });

    router.get("/status", async (ctx, next) => {
      const response = await this.statusCommand.run();
      this.processResponse(ctx.response, response);
      await next();
    });

    router.get("/list/object/:object", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }
      let response: Response = null;
      if (ctx.params.object === "send") {
        response = await this.sendListCommand.run(ctx.request.query);
      } else {
        response = await this.listCommand.run(ctx.params.object, ctx.request.query);
      }
      this.processResponse(ctx.response, response);
      await next();
    });

    router.get("/send/list", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }
      const response = await this.sendListCommand.run(ctx.request.query);
      this.processResponse(ctx.response, response);
      await next();
    });

    router.post("/sync", async (ctx, next) => {
      const response = await this.syncCommand.run(ctx.request.query);
      this.processResponse(ctx.response, response);
      await next();
    });

    router.post("/lock", async (ctx, next) => {
      const response = await this.lockCommand.run();
      this.processResponse(ctx.response, response);
      await next();
    });

    router.post("/unlock", async (ctx, next) => {
      // Do not allow guessing password location through serve command
      delete ctx.request.query.passwordFile;
      delete ctx.request.query.passwordEnv;

      const response = await this.unlockCommand.run(
        ctx.request.body.password == null ? null : (ctx.request.body.password as string),
        ctx.request.query,
      );
      this.processResponse(ctx.response, response);
      await next();
    });

    router.post("/confirm/:object/:id", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }
      const response = await this.confirmCommand.run(
        ctx.params.object,
        ctx.params.id,
        ctx.request.query,
      );
      this.processResponse(ctx.response, response);
      await next();
    });

    router.post("/restore/:object/:id", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }
      const response = await this.restoreCommand.run(ctx.params.object, ctx.params.id);
      this.processResponse(ctx.response, response);
      await next();
    });

    router.post("/move/:id/:organizationId", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }
      const response = await this.shareCommand.run(
        ctx.params.id,
        ctx.params.organizationId,
        ctx.request.body, // TODO: Check the format of this body for an array of collection ids
      );
      this.processResponse(ctx.response, response);
      await next();
    });

    router.post("/attachment", koaMulter().single("file"), async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }
      const response = await this.createCommand.run(
        "attachment",
        ctx.request.body,
        ctx.request.query,
        {
          fileBuffer: ctx.request.file.buffer,
          fileName: ctx.request.file.originalname,
        },
      );
      this.processResponse(ctx.response, response);
      await next();
    });

    router.post("/send/:id/remove-password", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }
      const response = await this.sendRemovePasswordCommand.run(ctx.params.id);
      this.processResponse(ctx.response, response);
      await next();
    });

    router.post("/object/:object", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }
      let response: Response = null;
      if (ctx.params.object === "send") {
        response = await this.sendCreateCommand.run(ctx.request.body, ctx.request.query);
      } else {
        response = await this.createCommand.run(
          ctx.params.object,
          ctx.request.body,
          ctx.request.query,
        );
      }
      this.processResponse(ctx.response, response);
      await next();
    });

    router.put("/object/:object/:id", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }
      let response: Response = null;
      if (ctx.params.object === "send") {
        ctx.request.body.id = ctx.params.id;
        response = await this.sendEditCommand.run(ctx.request.body, ctx.request.query);
      } else {
        response = await this.editCommand.run(
          ctx.params.object,
          ctx.params.id,
          ctx.request.body,
          ctx.request.query,
        );
      }
      this.processResponse(ctx.response, response);
      await next();
    });

    router.get("/object/:object/:id", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }
      let response: Response = null;
      if (ctx.params.object === "send") {
        response = await this.sendGetCommand.run(ctx.params.id, null);
      } else {
        response = await this.getCommand.run(ctx.params.object, ctx.params.id, ctx.request.query);
      }
      this.processResponse(ctx.response, response);
      await next();
    });

    router.delete("/object/:object/:id", async (ctx, next) => {
      if (await this.errorIfLocked(ctx.response)) {
        await next();
        return;
      }
      let response: Response = null;
      if (ctx.params.object === "send") {
        response = await this.sendDeleteCommand.run(ctx.params.id);
      } else {
        response = await this.deleteCommand.run(
          ctx.params.object,
          ctx.params.id,
          ctx.request.query,
        );
      }
      this.processResponse(ctx.response, response);
      await next();
    });

    server
      .use(router.routes())
      .use(router.allowedMethods())
      .listen(port, hostname === "all" ? null : hostname, () => {
        this.serviceContainer.logService.info("Listening on " + hostname + ":" + port);
      });
  }

  private processResponse(res: koa.Response, commandResponse: Response) {
    if (!commandResponse.success) {
      res.status = 400;
    }
    if (commandResponse.data instanceof FileResponse) {
      res.body = commandResponse.data.data;
      res.attachment(commandResponse.data.fileName);
      res.set("Content-Type", "application/octet-stream");
      res.set("Content-Length", commandResponse.data.data.length.toString());
    } else {
      res.body = commandResponse;
    }
  }

  private async errorIfLocked(res: koa.Response) {
    const authed = await this.serviceContainer.stateService.getIsAuthenticated();
    if (!authed) {
      this.processResponse(res, Response.error("You are not logged in."));
      return true;
    }
    if (await this.serviceContainer.cryptoService.hasUserKey()) {
      return false;
    }
    this.processResponse(res, Response.error("Vault is locked."));
    return true;
  }
}
